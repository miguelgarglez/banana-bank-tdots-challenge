import { randomUUID } from 'node:crypto';
import { bankRequest, BankError } from './client';
import { appDb } from '../db';
import type { DispatchResult, Operation, ToolContext, TransferInput } from '../types';
const UNKNOWN =
  'The bank did not confirm the operation. Do not retry; the status will be verified against the ledger.';
export async function dispatchTransfer(
  ctx: ToolContext,
  input: TransferInput,
): Promise<DispatchResult> {
  const db = appDb();
  const intent = db.prepare('SELECT bank_reference FROM intents WHERE id=?').get(ctx.intentId) as
    { bank_reference: string | null } | undefined;
  const reference = intent?.bank_reference || randomUUID();
  if (reference !== intent?.bank_reference)
    db.prepare('UPDATE intents SET bank_reference=? WHERE id=?').run(reference, ctx.intentId);
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
          return { status: 'unknown', reference, error: UNKNOWN };
      }
    }
  }
  return { status: 'unknown', reference, error: UNKNOWN };
}
