import { randomUUID } from 'node:crypto';
import { bankRequest } from './client';
import { HttpError } from '../auth';
import { appDb } from '../db';
import { recordEvent } from '../telemetry';
import type { Account, ActionResult, ToolContext, TransferInput } from '../types';
const fail = (error: string): ActionResult => ({ status: 'failed', error });
export async function authorizeTransfer(
  ctx: ToolContext,
  input: TransferInput,
): Promise<ActionResult | null> {
  const accounts = await bankRequest<Account[]>(ctx.userId, '/v1/accounts');
  const from = accounts.find((a) => a.id === input.fromAccountId);
  if (!from) throw new HttpError(403, 'This account does not belong to this person.');
  const db = appDb();
  if (!ctx.approvalId) {
    const contacts = await bankRequest<(Account & { name?: string })[]>(ctx.userId, '/v1/contacts');
    const to = contacts.find((c) => c.id === input.toAccountId);
    const proposal = {
      fromAccountId: from.id,
      fromLabel: from.label,
      toAccountId: input.toAccountId,
      toName: to?.name || null,
      toLabel: to?.label || null,
      amountCents: input.amountCents,
      concept: input.concept,
    };
    const existing = db
      .prepare(
        `SELECT a.id,a.intent_id,a.expires_at FROM approvals a JOIN intents i ON i.id=a.intent_id
         WHERE a.user_id=? AND a.payload=? AND a.consumed_at IS NULL AND a.expires_at>? AND i.conversation_id IS ?`,
      )
      .get(ctx.userId, JSON.stringify(input), new Date().toISOString(), ctx.conversationId) as
      { id: string; intent_id: string; expires_at: string } | undefined;
    if (existing) {
      db.prepare("UPDATE intents SET status='superseded' WHERE id=?").run(ctx.intentId);
      return {
        status: 'requires_confirmation',
        approvalId: existing.id,
        intentId: existing.intent_id,
        expiresAt: existing.expires_at,
        proposal,
      };
    }
    const approvalId = randomUUID(),
      expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO approvals VALUES(?,?,?,?,?,?)').run(
      approvalId,
      ctx.userId,
      ctx.intentId,
      JSON.stringify(input),
      expiresAt,
      null,
    );
    db.prepare("UPDATE intents SET status='awaiting_confirmation' WHERE id=?").run(ctx.intentId);
    recordEvent(ctx, 'transfer.proposed', {
      status: 'awaiting_confirmation',
      approvalId,
      input,
      intentId: ctx.intentId,
    });
    return {
      status: 'requires_confirmation',
      approvalId,
      intentId: ctx.intentId,
      expiresAt,
      proposal,
    };
  }
  const approval = db.prepare('SELECT * FROM approvals WHERE id=?').get(ctx.approvalId) as
    | {
        user_id: string;
        intent_id: string;
        payload: string;
        expires_at: string;
        consumed_at: string | null;
      }
    | undefined;
  if (!approval || approval.user_id !== ctx.userId || approval.intent_id !== ctx.intentId)
    return fail('Proposal not found.');
  if (approval.payload !== JSON.stringify(input))
    return fail('The proposal does not match these details.');
  const intent = db.prepare('SELECT status,run_id FROM intents WHERE id=?').get(ctx.intentId) as
    { status: string; run_id: string | null } | undefined;
  if (approval.expires_at <= new Date().toISOString()) {
    db.prepare("UPDATE intents SET status='expired' WHERE id=?").run(ctx.intentId);
    return fail('This proposal has expired. Ask for a new one.');
  }
  if (approval.consumed_at && intent?.status !== 'unknown')
    return fail('This proposal was already used.');
  if (intent?.run_id === ctx.runId)
    return fail('Confirmation must come from the customer in a later message.');
  db.prepare('UPDATE approvals SET consumed_at=? WHERE id=?').run(
    new Date().toISOString(),
    ctx.approvalId,
  );
  return null;
}
