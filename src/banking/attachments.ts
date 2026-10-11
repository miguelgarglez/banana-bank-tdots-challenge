import { appDb } from '../db';
import { confirmationCode } from './authorization';
import type { TransferInput } from '../types';

export type TransferAttachment =
  | {
      kind: 'draft';
      id: string;
      draft: {
        fromAccountId: string | null;
        toAccountId: string | null;
        amountCents: number | null;
        concept: string | null;
      };
    }
  | {
      kind: 'intent';
      id: string;
      status: string;
      payload: TransferInput;
      approval: { id: string; confirmationCode: string; expiresAt: string } | null;
      reference: string | null;
      error: string | null;
    };

export function transferAttachments(
  userId: string,
  conversationId: string,
): Map<string, TransferAttachment[]> {
  const db = appDb();
  const map = new Map<string, TransferAttachment[]>();
  const push = (runId: string, a: TransferAttachment) => {
    const list = map.get(runId);
    if (list) list.push(a);
    else map.set(runId, [a]);
  };
  const draftRun = new Map<string, string>();
  for (const e of db
    .prepare(
      "SELECT run_id,data,created_at FROM events WHERE kind='transfer.drafted' AND conversation_id=? AND user_id=? ORDER BY created_at",
    )
    .all(conversationId, userId) as { run_id: string; data: string; created_at: string }[]) {
    const data = JSON.parse(e.data) as {
      draftId: string;
      draft: Extract<TransferAttachment, { kind: 'draft' }>['draft'];
    };
    const { draft } = data;
    draftRun.set(data.draftId, e.run_id);
    push(e.run_id, { kind: 'draft', id: data.draftId, draft });
  }
  const now = new Date().toISOString();
  for (const i of db
    .prepare('SELECT * FROM intents WHERE user_id=? AND conversation_id IS ? ORDER BY created_at')
    .all(userId, conversationId) as {
    id: string;
    run_id: string | null;
    payload: string;
    status: string;
    bank_reference: string | null;
    error: string | null;
  }[]) {
    const approval = db
      .prepare(
        'SELECT id,expires_at FROM approvals WHERE intent_id=? AND consumed_at IS NULL AND expires_at>?',
      )
      .get(i.id, now) as { id: string; expires_at: string } | undefined;
    const attachment: TransferAttachment = {
      kind: 'intent',
      id: i.id,
      status: i.status,
      payload: JSON.parse(i.payload),
      approval: approval
        ? {
            id: approval.id,
            confirmationCode: confirmationCode(approval.id),
            expiresAt: approval.expires_at,
          }
        : null,
      reference: i.bank_reference,
      error: i.error,
    };
    const runId = draftRun.get(i.id) ?? i.run_id;
    if (!runId) continue;
    const list = map.get(runId);
    const idx = list?.findIndex((a) => a.id === i.id) ?? -1;
    if (list && idx >= 0) list[idx] = attachment;
    else push(runId, attachment);
  }
  return map;
}
