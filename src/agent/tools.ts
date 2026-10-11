import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FunctionTool } from 'openai/resources/responses/responses';
import { bankRequest, BankError } from '../banking/client';
import { transferMoney } from '../banking/actions';
import { resolveIntent } from '../banking/resolve';
import { searchDocuments } from '../retrieval/search';
import { appDb } from '../db';
import { recordEvent } from '../telemetry';
import { person } from '../people';
import { HttpError } from '../auth';
import type { Account, Operation, ToolContext } from '../types';
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const string = { type: 'string' };
export const toolDefinitions: FunctionTool[] = [
  {
    type: 'function',
    name: 'list_accounts',
    description: "Get the current customer's accounts, balances, and available recipients.",
    parameters: object({}),
    strict: true,
  },
  {
    type: 'function',
    name: 'search_documents',
    description: "Search the bank's documentation for policies and procedures.",
    parameters: object({
      query: string,
      includeArchived: {
        type: 'boolean',
        description: 'Set true only when the customer asks about past or historical terms.',
      },
    }),
    strict: true,
  },
  {
    type: 'function',
    name: 'transfer_money',
    description:
      'Propose a transfer between simulator accounts. Returns a proposal that the customer must confirm before any money moves. Amounts are integer cents.',
    parameters: object({
      fromAccountId: string,
      toAccountId: string,
      amountCents: { type: 'integer' },
      concept: string,
    }),
    strict: true,
  },
  {
    type: 'function',
    name: 'draft_transfer',
    description:
      'Open an editable transfer card for the customer when they want to send money but any detail (source account, recipient account, amount, concept) is missing or ambiguous. Pass what you know and null for the rest. The customer completes and reviews it in the card; no money moves and no proposal is created by this tool.',
    parameters: object({
      fromAccountId: { type: ['string', 'null'] },
      toAccountId: { type: ['string', 'null'] },
      amountCents: { type: ['integer', 'null'] },
      concept: { type: ['string', 'null'] },
    }),
    strict: true,
  },
  {
    type: 'function',
    name: 'confirm_transfer',
    description:
      'Execute a transfer proposal after the customer has explicitly confirmed its exact summary in a later message.',
    parameters: object({ approvalId: string }),
    strict: true,
  },
  {
    type: 'function',
    name: 'operation_status',
    description: 'Look up an operation by its bank reference.',
    parameters: object({ reference: string }),
    strict: true,
  },
  {
    type: 'function',
    name: 'request_human',
    description: 'Open a human support case for this conversation.',
    parameters: object({ summary: string }),
    strict: true,
  },
];
export async function runTool(name: string, args: unknown, ctx: ToolContext): Promise<unknown> {
  const started = Date.now();
  recordEvent(ctx, 'tool.started', { tool: name, status: 'started', arguments: args });
  let result: unknown;
  try {
    switch (name) {
      case 'list_accounts':
        result = {
          accounts: await bankRequest(ctx.userId, '/v1/accounts'),
          contacts: await bankRequest(ctx.userId, '/v1/contacts'),
        };
        break;
      case 'search_documents': {
        const { query, includeArchived } = z
          .object({ query: z.string().max(2000), includeArchived: z.boolean() })
          .parse(args);
        result = { sources: await searchDocuments(query, 'customer', 5, includeArchived) };
        break;
      }
      case 'transfer_money':
        result = await transferMoney(ctx, args);
        break;
      case 'draft_transfer': {
        if (person(ctx.userId)?.role !== 'customer')
          throw new HttpError(403, 'A customer account is required.');
        const draft = z
          .object({
            fromAccountId: z.string().nullable(),
            toAccountId: z.string().nullable(),
            amountCents: z.number().int().positive().nullable(),
            concept: z.string().max(200).nullable(),
          })
          .parse(args);
        const [accounts, contacts] = await Promise.all([
          bankRequest<Account[]>(ctx.userId, '/v1/accounts'),
          bankRequest<Account[]>(ctx.userId, '/v1/contacts'),
        ]);
        if (!accounts.some((a) => a.id === draft.fromAccountId)) draft.fromAccountId = null;
        if (!contacts.some((c) => c.id === draft.toAccountId)) draft.toAccountId = null;
        const draftId = randomUUID();
        recordEvent(ctx, 'transfer.drafted', { draftId, draft });
        result = {
          status: 'draft',
          draftId,
          draft,
          note: 'The customer now sees an editable transfer card under your reply. Reply in one short sentence pointing to it; do not list the details again.',
        };
        break;
      }
      case 'confirm_transfer': {
        const { approvalId } = z.object({ approvalId: z.string() }).parse(args);
        const approval = appDb()
          .prepare('SELECT * FROM approvals WHERE id=? AND user_id=?')
          .get(approvalId, ctx.userId) as { intent_id: string; payload: string } | undefined;
        result = approval
          ? await transferMoney(
              { ...ctx, intentId: approval.intent_id, approvalId, confirmedBy: 'message' },
              JSON.parse(approval.payload),
            )
          : { status: 'failed', error: 'Proposal not found.' };
        break;
      }
      case 'operation_status': {
        const reference = z.object({ reference: z.string() }).parse(args).reference;
        const pending = appDb()
          .prepare(
            "SELECT id FROM intents WHERE user_id=? AND bank_reference=? AND status IN ('unknown','processing')",
          )
          .get(ctx.userId, reference) as { id: string } | undefined;
        let operation: Operation;
        try {
          operation = await bankRequest<Operation>(
            ctx.userId,
            `/v1/operations/${encodeURIComponent(reference)}`,
          );
        } catch (e) {
          if (e instanceof BankError && e.status === 404 && pending) {
            const resolved = await resolveIntent(ctx.userId, pending.id);
            result = { ...resolved, intentStatus: resolved.status };
            break;
          }
          throw e;
        }
        if (pending) {
          const resolved = await resolveIntent(ctx.userId, pending.id, operation);
          result = { ...resolved, intentStatus: resolved.status };
        } else result = operation;
        break;
      }
      case 'request_human': {
        if (!ctx.conversationId) throw new Error('A conversation is required to open a case.');
        const { summary } = z.object({ summary: z.string().min(1).max(2000) }).parse(args);
        const existing = appDb()
          .prepare('SELECT id FROM incidents WHERE conversation_id=? AND status=?')
          .get(ctx.conversationId, 'open') as { id: string } | undefined;
        const id = existing?.id || randomUUID();
        if (!existing)
          appDb()
            .prepare('INSERT INTO incidents VALUES(?,?,?,?,?,?)')
            .run(id, ctx.userId, ctx.conversationId, summary, 'open', new Date().toISOString());
        result = { status: 'open', incidentId: id };
        break;
      }
      default:
        throw new Error('Unknown tool.');
    }
    recordEvent(ctx, 'tool.completed', {
      tool: name,
      status: 'completed',
      arguments: args,
      output: result,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Tool error';
    recordEvent(ctx, 'tool.failed', {
      tool: name,
      status: 'failed',
      arguments: args,
      error,
      durationMs: Date.now() - started,
    });
    return { status: 'failed', error };
  }
}
