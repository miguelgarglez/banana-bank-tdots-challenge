import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appDb } from '../db';
import { HttpError } from '../auth';
import { person } from '../people';
import { authorizeTransfer } from './authorization';
import { dispatchTransfer, UNKNOWN_MESSAGE } from './dispatch';
import { bankRequest, BankError } from './client';
import { recordEvent } from '../telemetry';
import type { ActionResult, Operation, ToolContext } from '../types';
export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amountCents: z.number().int().positive().max(10000000),
    concept: z.string().max(200),
  })
  .strict();
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
export async function transferMoney(ctx: ToolContext, args: unknown): Promise<ActionResult> {
  if (person(ctx.userId)?.role !== 'customer')
    throw new HttpError(403, 'A customer account is required.');
  const input = transferSchema.parse(args),
    db = appDb();
  const previous = db
    .prepare('SELECT user_id,payload,status,bank_reference,operation_id FROM intents WHERE id=?')
    .get(ctx.intentId) as
    | {
        user_id: string;
        payload: string;
        status: string;
        bank_reference: string | null;
        operation_id: string | null;
      }
    | undefined;
  if (previous && (previous.user_id !== ctx.userId || previous.payload !== JSON.stringify(input)))
    throw new HttpError(409, 'This intent belongs to a different payload.');
  if (previous?.status === 'completed') {
    if (previous.bank_reference) {
      try {
        const operation = await bankRequest<Operation>(
          ctx.userId,
          `/v1/operations/${encodeURIComponent(previous.bank_reference)}`,
        );
        return { status: 'completed', operation, intentId: ctx.intentId, replay: true };
      } catch {
        // fall through to the stored state
      }
    }
    return {
      status: 'completed',
      intentId: ctx.intentId,
      operationId: previous.operation_id,
      replay: true,
    };
  }
  if (previous?.status === 'unknown') return resolveIntent(ctx.userId, ctx.intentId);
  db.prepare('INSERT OR IGNORE INTO intents VALUES(?,?,?,?,?,?,?,?,?,?)').run(
    ctx.intentId,
    ctx.userId,
    ctx.conversationId,
    ctx.runId,
    JSON.stringify(input),
    'created',
    null,
    null,
    null,
    new Date().toISOString(),
  );
  const permission = await authorizeTransfer(ctx, input);
  if (permission) return permission;
  db.prepare('UPDATE intents SET status=? WHERE id=?').run('processing', ctx.intentId);
  recordEvent(ctx, 'transfer.started', { status: 'processing', input, intentId: ctx.intentId });
  try {
    const result = await dispatchTransfer(ctx, input);
    if (result.status === 'unknown') {
      db.prepare('UPDATE intents SET status=?,bank_reference=?,error=? WHERE id=?').run(
        'unknown',
        result.reference,
        result.error,
        ctx.intentId,
      );
      recordEvent(ctx, 'transfer.unknown', {
        status: 'unknown',
        reference: result.reference,
        error: result.error,
        intentId: ctx.intentId,
      });
      return {
        status: 'unknown',
        reference: result.reference,
        intentId: ctx.intentId,
        error: result.error,
      };
    }
    db.prepare(
      'UPDATE intents SET status=?,operation_id=?,bank_reference=?,error=NULL WHERE id=?',
    ).run('completed', result.operation.id, result.operation.reference, ctx.intentId);
    recordEvent(ctx, 'transfer.completed', {
      status: 'completed',
      operation: result.operation,
      intentId: ctx.intentId,
    });
    return { status: 'completed', operation: result.operation, intentId: ctx.intentId };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Transfer error';
    db.prepare('UPDATE intents SET status=?,error=? WHERE id=?').run(
      'failed',
      message,
      ctx.intentId,
    );
    recordEvent(ctx, 'transfer.failed', {
      status: 'failed',
      error: message,
      intentId: ctx.intentId,
    });
    return { status: 'failed', error: message, intentId: ctx.intentId };
  }
}
