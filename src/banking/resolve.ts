import { randomUUID } from 'node:crypto';
import { appDb } from '../db';
import { bankRequest, BankError } from './client';
import { UNKNOWN_MESSAGE } from './dispatch';
import { recordEvent } from '../telemetry';
import type { ActionResult, Operation, ToolContext } from '../types';
export async function resolveIntent(userId: string, intentId: string): Promise<ActionResult> {
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
      }
    | undefined;
  if (!intent || intent.status !== 'unknown' || !intent.bank_reference)
    return { status: intent?.status || 'unknown', intentId };
  const ctx: ToolContext = {
    userId,
    conversationId: intent.conversation_id,
    runId: randomUUID(),
    intentId,
  };
  try {
    const operation = await bankRequest<Operation>(
      userId,
      `/v1/operations/${encodeURIComponent(intent.bank_reference)}`,
    );
    db.prepare("UPDATE intents SET status='completed',operation_id=?,error=NULL WHERE id=?").run(
      operation.id,
      intentId,
    );
    recordEvent(ctx, 'transfer.resolved', { status: 'completed', operation, intentId });
    return { status: 'completed', operation, intentId, resolved: true };
  } catch (e) {
    if (e instanceof BankError && e.status === 404) {
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
    return {
      status: 'unknown',
      reference: intent.bank_reference,
      intentId,
      error: UNKNOWN_MESSAGE,
    };
  }
}
