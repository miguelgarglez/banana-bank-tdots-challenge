import { randomUUID } from 'node:crypto';
import { appDb } from '../db';
import { bankRequest, BankError } from './client';
import { UNKNOWN_MESSAGE } from './dispatch';
import { recordEvent } from '../telemetry';
import type { ActionResult, Operation, ToolContext, TransferInput } from '../types';
export async function resolveIntent(
  userId: string,
  intentId: string,
  operation?: Operation,
): Promise<ActionResult> {
  const db = appDb();
  const intent = db
    .prepare('SELECT * FROM intents WHERE id=? AND user_id=?')
    .get(intentId, userId) as
    | {
        status: string;
        bank_reference: string | null;
        operation_id: string | null;
        error: string | null;
        conversation_id: string | null;
        created_at: string;
      }
    | undefined;
  if (
    !intent ||
    !['unknown', 'processing'].includes(intent.status) ||
    (intent.status === 'unknown' && !intent.bank_reference)
  )
    return { status: intent?.status || 'unknown', intentId };
  if (!intent.bank_reference) return { status: 'processing', intentId };
  const ctx: ToolContext = {
    userId,
    conversationId: intent.conversation_id,
    runId: randomUUID(),
    intentId,
  };
  try {
    const found =
      operation ||
      (await bankRequest<Operation>(
        userId,
        `/v1/operations/${encodeURIComponent(intent.bank_reference)}`,
      ));
    db.prepare("UPDATE intents SET status='completed',operation_id=?,error=NULL WHERE id=?").run(
      found.id,
      intentId,
    );
    recordEvent(ctx, 'transfer.resolved', { status: 'completed', operation: found, intentId });
    return { status: 'completed', operation: found, intentId, resolved: true };
  } catch (e) {
    const stale = Date.now() - new Date(intent.created_at).getTime() > 5 * 60 * 1000;
    if (e instanceof BankError && e.status === 404 && (intent.status === 'unknown' || stale)) {
      db.prepare("UPDATE intents SET status='failed',error=? WHERE id=?").run(
        'The bank has no record of this operation.',
        intentId,
      );
      recordEvent(ctx, 'transfer.resolved', { status: 'failed', intentId });
      return {
        status: 'failed',
        error: 'The bank has no record of this operation.',
        intentId,
        resolved: true,
      };
    }
    if (intent.status === 'processing') return { status: 'processing', intentId };
    return {
      status: 'unknown',
      reference: intent.bank_reference,
      intentId,
      error: UNKNOWN_MESSAGE,
    };
  }
}
export async function unresolvedEquivalent(
  userId: string,
  input: TransferInput,
  excludeIntentId: string,
): Promise<{ id: string; bank_reference: string | null } | null> {
  const candidates = appDb()
    .prepare(
      "SELECT id,bank_reference,payload FROM intents WHERE user_id=? AND status IN ('unknown','processing') AND id!=?",
    )
    .all(userId, excludeIntentId) as {
    id: string;
    bank_reference: string | null;
    payload: string;
  }[];
  for (const candidate of candidates) {
    let payload: TransferInput;
    try {
      payload = JSON.parse(candidate.payload);
    } catch {
      continue;
    }
    if (
      payload.fromAccountId !== input.fromAccountId ||
      payload.toAccountId !== input.toAccountId ||
      payload.amountCents !== input.amountCents
    )
      continue;
    const resolved = await resolveIntent(userId, candidate.id);
    if (['unknown', 'processing'].includes(String(resolved.status))) return candidate;
  }
  return null;
}
