import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FunctionTool } from 'openai/resources/responses/responses';
import { bankRequest } from '../banking/client';
import { transferMoney } from '../banking/actions';
import { searchDocuments } from '../retrieval/search';
import { appDb } from '../db';
import { recordEvent } from '../telemetry';
import type { ToolContext } from '../types';
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
      case 'confirm_transfer': {
        const { approvalId } = z.object({ approvalId: z.string() }).parse(args);
        const approval = appDb()
          .prepare('SELECT * FROM approvals WHERE id=? AND user_id=?')
          .get(approvalId, ctx.userId) as { intent_id: string; payload: string } | undefined;
        result = approval
          ? await transferMoney(
              { ...ctx, intentId: approval.intent_id, approvalId },
              JSON.parse(approval.payload),
            )
          : { status: 'failed', error: 'Proposal not found.' };
        break;
      }
      case 'operation_status':
        result = await bankRequest(
          ctx.userId,
          `/v1/operations/${encodeURIComponent(z.object({ reference: z.string() }).parse(args).reference)}`,
        );
        break;
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
