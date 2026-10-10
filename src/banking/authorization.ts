import { randomUUID } from 'node:crypto';
import { bankRequest } from './client';
import { resolveIntent } from './resolve';
import { HttpError } from '../auth';
import { appDb } from '../db';
import { recordEvent } from '../telemetry';
import type { Account, ActionResult, ToolContext, TransferInput } from '../types';
const fail = (code: string, error: string): ActionResult => ({ status: 'failed', code, error });
export const confirmationCode = (approvalId: string) =>
  approvalId.replace(/-/g, '').slice(0, 6).toUpperCase();
export async function authorizeTransfer(
  ctx: ToolContext,
  input: TransferInput,
): Promise<ActionResult | null> {
  const db = appDb();
  if (!ctx.approvalId) {
    const unverified = db
      .prepare(
        "SELECT id,bank_reference FROM intents WHERE user_id=? AND payload=? AND status IN ('unknown','processing') AND id!=?",
      )
      .all(ctx.userId, JSON.stringify(input), ctx.intentId) as {
      id: string;
      bank_reference: string | null;
    }[];
    for (const pending of unverified) {
      const resolved = await resolveIntent(ctx.userId, pending.id);
      if (resolved.status === 'unknown') {
        db.prepare("UPDATE intents SET status='blocked' WHERE id=?").run(ctx.intentId);
        return {
          status: 'blocked',
          code: 'pending_verification',
          intentId: pending.id,
          reference: pending.bank_reference,
          error: `An identical transfer is still awaiting the bank's confirmation (reference ${pending.bank_reference}). It will be verified before any new transfer with the same details.`,
        };
      }
    }
    const accounts = await bankRequest<Account[]>(ctx.userId, '/v1/accounts');
    const from = accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new HttpError(403, 'This account does not belong to this person.');
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
      confirmationCode: confirmationCode(approvalId),
      proposal,
    };
  }
  const accounts = await bankRequest<Account[]>(ctx.userId, '/v1/accounts');
  if (!accounts.some((a) => a.id === input.fromAccountId))
    throw new HttpError(403, 'This account does not belong to this person.');
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
    return fail('not_found', 'Proposal not found.');
  if (approval.payload !== JSON.stringify(input))
    return fail('mismatch', 'The proposal does not match these details.');
  const intent = db.prepare('SELECT status FROM intents WHERE id=?').get(ctx.intentId) as
    { status: string } | undefined;
  if (
    intent?.status === 'awaiting_confirmation' &&
    approval.expires_at <= new Date().toISOString()
  ) {
    db.prepare("UPDATE intents SET status='expired' WHERE id=?").run(ctx.intentId);
    return fail('expired', 'This proposal has expired. Ask for a new one.');
  }
  if (approval.consumed_at && intent?.status !== 'unknown')
    return fail('already_used', 'This proposal was already used.');
  if (!ctx.confirmedBy) return fail('channel_unknown', 'Confirmation channel unknown.');
  if (ctx.confirmedBy === 'message') {
    const message = db
      .prepare("SELECT content FROM messages WHERE run_id=? AND role='user'")
      .get(ctx.runId) as { content: string } | undefined;
    const code = confirmationCode(ctx.approvalId).toLowerCase();
    const words = (message?.content || '')
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü]+/g, ' ')
      .split(' ')
      .filter(Boolean);
    let found = false;
    for (let i = 0; i < words.length && !found; i++) {
      let acc = '';
      for (let j = i; j < words.length; j++) {
        acc += words[j];
        if (acc === code) {
          words.splice(i, j - i + 1);
          found = true;
          break;
        }
        if (acc.length >= code.length || !code.startsWith(acc)) break;
      }
    }
    const allowed = new Set(
      'confirm confirmo confirmar confirmed confirmation yes si sí ok okay code código codigo the el la es is please por favor autorizo authorize approve apruebo transfer transferencia de this esta esto'.split(
        ' ',
      ),
    );
    if (!found || words.some((w) => !allowed.has(w)))
      return fail(
        'code_required',
        'Ask the customer to reply with only the confirmation code (for example: confirm 7F3A2B).',
      );
  }
  const consumed = db
    .prepare('UPDATE approvals SET consumed_at=? WHERE id=? AND consumed_at IS NULL')
    .run(new Date().toISOString(), ctx.approvalId);
  if (consumed.changes === 0 && intent?.status !== 'unknown')
    return fail('already_used', 'This proposal was already used.');
  return null;
}
