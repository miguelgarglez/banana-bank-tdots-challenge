import { randomUUID } from 'node:crypto';
import { bankRequest, BankError } from './client';
import { appDb } from '../db';
import type { DispatchResult, Operation, ToolContext, TransferInput } from '../types';

export const UNKNOWN_MESSAGE =
  'The bank has not confirmed this operation yet. Its status will be verified against the ledger; it must not be sent again.';

export async function dispatchTransfer(
  ctx: ToolContext,
  input: TransferInput,
): Promise<DispatchResult> {
  const db = appDb();
  let intent = db.prepare('SELECT bank_reference FROM intents WHERE id=?').get(ctx.intentId) as
    { bank_reference: string | null } | undefined;
  if (!intent?.bank_reference) {
    db.prepare('UPDATE intents SET bank_reference=? WHERE id=? AND bank_reference IS NULL').run(
      randomUUID(),
      ctx.intentId,
    );
    intent = db.prepare('SELECT bank_reference FROM intents WHERE id=?').get(ctx.intentId) as {
      bank_reference: string | null;
    };
  }
  const reference = intent.bank_reference as string;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const operation = await bankRequest<Operation>(ctx.userId, '/v1/transfers', 'POST', {
        ...input,
        reference,
      });
      return { status: 'completed', operation };
    } catch (e) {
      if (!(e instanceof BankError) || e.status < 500) throw e;
      try {
        const operation = await bankRequest<Operation>(
          ctx.userId,
          `/v1/operations/${encodeURIComponent(reference)}`,
        );
        return { status: 'completed', operation };
      } catch (lookup) {
        if (!(lookup instanceof BankError) || lookup.status !== 404)
          return { status: 'unknown', reference, error: UNKNOWN_MESSAGE };
      }
    }
  }
  return { status: 'unknown', reference, error: UNKNOWN_MESSAGE };
}
