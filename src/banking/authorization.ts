import { randomUUID } from 'node:crypto';
import { bankRequest } from './client';
import { unresolvedEquivalent } from './resolve';
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
    const pending = await unresolvedEquivalent(ctx.userId, input, ctx.intentId);
    if (pending) {
      db.prepare("UPDATE intents SET status='blocked' WHERE id=?").run(ctx.intentId);
      return {
        status: 'blocked',
        code: 'pending_verification',
        intentId: pending.id,
        reference: pending.bank_reference,
        error: `An identical transfer is still awaiting the bank's confirmation (reference ${pending.bank_reference}). It will be verified before any new transfer with the same details.`,
      };
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
    const active = db
      .prepare(
        'SELECT id,expires_at FROM approvals WHERE intent_id=? AND consumed_at IS NULL AND expires_at>?',
      )
      .get(ctx.intentId, new Date().toISOString()) as
      { id: string; expires_at: string } | undefined;
    if (active)
      return {
        status: 'requires_confirmation',
        approvalId: active.id,
        intentId: ctx.intentId,
        expiresAt: active.expires_at,
        confirmationCode: confirmationCode(active.id),
        proposal,
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
  if (intent?.status !== 'unknown' && approval.expires_at <= new Date().toISOString()) {
    if (intent?.status === 'awaiting_confirmation')
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
  const pending = await unresolvedEquivalent(ctx.userId, input, ctx.intentId);
  if (pending)
    return fail(
      'pending_verification',
      `An identical transfer is still awaiting the bank's confirmation (reference ${pending.bank_reference}). It will be verified before any new transfer with the same details.`,
    );
  const consumed = db
    .prepare('UPDATE approvals SET consumed_at=? WHERE id=? AND consumed_at IS NULL')
    .run(new Date().toISOString(), ctx.approvalId);
  if (consumed.changes === 0 && intent?.status !== 'unknown')
    return fail('already_used', 'This proposal was already used.');
  return null;
}
export function dismissProposal(userId: string, approvalId: string) {
  const db = appDb();
  const approval = db
    .prepare('SELECT * FROM approvals WHERE id=? AND user_id=?')
    .get(approvalId, userId) as
    { id: string; intent_id: string; consumed_at: string | null } | undefined;
  if (!approval) throw new HttpError(404, 'Proposal not found.');
  if (approval.consumed_at) throw new HttpError(409, 'This proposal was already used.');
  const now = new Date().toISOString();
  db.prepare('UPDATE approvals SET consumed_at=? WHERE id=?').run(now, approvalId);
  const intent = db
    .prepare('SELECT conversation_id FROM intents WHERE id=?')
    .get(approval.intent_id) as { conversation_id: string | null } | undefined;
  db.prepare(
    "UPDATE intents SET status='cancelled' WHERE id=? AND status='awaiting_confirmation'",
  ).run(approval.intent_id);
  recordEvent(
    {
      userId,
      conversationId: intent?.conversation_id ?? null,
      runId: randomUUID(),
      intentId: approval.intent_id,
    },
    'transfer.cancelled',
    { approvalId, intentId: approval.intent_id, by: 'customer' },
  );
  return { status: 'cancelled', approvalId, intentId: approval.intent_id };
}
