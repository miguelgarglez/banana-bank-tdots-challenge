import { z } from 'zod';
import { appDb } from '../db';
import { HttpError } from '../auth';
import { person } from '../people';
import { authorizeTransfer } from './authorization';
import { dispatchTransfer } from './dispatch';
import { resolveIntent } from './resolve';
import { bankRequest } from './client';
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
      } catch {}
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
