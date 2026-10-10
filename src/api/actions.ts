import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appDb } from '../db';
import { HttpError } from '../auth';
import { transferMoney } from '../banking/actions';
import { runTool } from '../agent/tools';
import { defineRoute } from './router';
import { conversationFor } from './shared';

export const actionRoutes = [
  defineRoute('POST', 'actions', 'any', async ({ json, current, body }) => {
    const parsed = z
      .object({
        name: z.enum([
          'transfer_money',
          'confirm_transfer',
          'request_human',
          'operation_status',
          'list_accounts',
          'search_documents',
        ]),
        arguments: z.unknown(),
        conversationId: z.string().nullable().optional(),
        intentId: z.string().max(150).optional(),
      })
      .parse(await body());
    if (current!.role !== 'customer') throw new HttpError(403, 'A customer is required.');
    if (parsed.conversationId) conversationFor(parsed.conversationId, current!.id);
    const ctx = {
      userId: current!.id,
      conversationId: parsed.conversationId || null,
      runId: randomUUID(),
      intentId: parsed.intentId || randomUUID(),
    };
    return json(await runTool(parsed.name, parsed.arguments, ctx));
  }),
  defineRoute('POST', 'approvals/:id/confirm', 'any', async ({ json, current, params }) => {
    const db = appDb();
    const approval = db
      .prepare('SELECT * FROM approvals WHERE id=? AND user_id=?')
      .get(params.id, current!.id) as any;
    if (!approval) throw new HttpError(404, 'Proposal not found.');
    const intent = db
      .prepare('SELECT * FROM intents WHERE id=? AND user_id=?')
      .get(approval.intent_id, current!.id) as any;
    if (!intent) throw new HttpError(404, 'Intent not found.');
    return json(
      await transferMoney(
        {
          userId: current!.id,
          conversationId: intent.conversation_id,
          runId: randomUUID(),
          intentId: intent.id,
          approvalId: approval.id,
          confirmedBy: 'click' as const,
        },
        JSON.parse(approval.payload),
      ),
    );
  }),
];
