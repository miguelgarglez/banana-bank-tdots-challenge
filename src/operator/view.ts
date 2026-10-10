import { randomUUID } from 'node:crypto';
import { appDb } from '../db';
import { person } from '../people';
import { HttpError } from '../auth';
import { bankRequest } from '../banking/client';
import type { Account, CaseDetail, IntentRecord, Operation, Reconciliation } from '../types';
function eur(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}
function reconcile(intents: IntentRecord[], operations: Operation[] | null): Reconciliation[] {
  return intents.map((intent) => {
    const operation =
      intent.bankReference && operations
        ? operations.find((o) => o.reference === intent.bankReference) || null
        : null;
    const bankStatus: Reconciliation['bankStatus'] = operation
      ? 'completed'
      : !operations || !intent.bankReference
        ? 'unverified'
        : 'not_found';
    let finding: string | null = null,
      fixable = false;
    if (intent.status !== 'completed' && bankStatus === 'completed' && operation) {
      finding = `App recorded ${intent.status}; the bank ledger shows a completed operation (${operation.reference}, ${eur(operation.amountCents)}, ${operation.createdAt}).`;
      fixable = true;
    } else if (intent.status === 'completed' && bankStatus === 'not_found') {
      finding = 'App recorded completed but the bank has no operation with this reference.';
    }
    return {
      intentId: intent.id,
      reference: intent.bankReference,
      amountCents: intent.payload.amountCents,
      appStatus: intent.status,
      bankStatus,
      operation,
      finding,
      fixable,
    };
  });
}
export async function caseDetail(operatorId: string, id: string): Promise<CaseDetail> {
  if (person(operatorId)?.role !== 'operator') throw new HttpError(403, 'Operator role required.');
  const db = appDb();
  const incident = db.prepare('SELECT * FROM incidents WHERE id=?').get(id) as
    CaseDetail['incident'] | undefined;
  if (!incident) throw new HttpError(404, 'Case not found.');
  const lastMessage = db
    .prepare(
      'SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',
    )
    .get(incident.conversation_id) as CaseDetail['lastMessage'];
  const history = db
    .prepare(
      'SELECT id,role,content,created_at FROM messages WHERE conversation_id=? ORDER BY created_at,rowid',
    )
    .all(incident.conversation_id) as CaseDetail['history'];
  const events = (
    db
      .prepare(
        'SELECT id,kind,data,created_at FROM events WHERE conversation_id=? ORDER BY created_at,rowid',
      )
      .all(incident.conversation_id) as {
      id: string;
      kind: string;
      data: string;
      created_at: string;
    }[]
  ).map((e) => {
    let data: unknown = e.data;
    try {
      data = JSON.parse(e.data);
    } catch {}
    return { id: e.id, kind: e.kind, data, created_at: e.created_at };
  });
  const intents = (
    db
      .prepare('SELECT * FROM intents WHERE conversation_id=? ORDER BY created_at,rowid')
      .all(incident.conversation_id) as any[]
  ).map((i): IntentRecord => ({
    id: i.id,
    status: i.status,
    payload: JSON.parse(i.payload),
    bankReference: i.bank_reference,
    operationId: i.operation_id,
    error: i.error,
    createdAt: i.created_at,
    conversationId: i.conversation_id,
    runId: i.run_id,
  }));
  let bank: CaseDetail['bank'] = null,
    bankError: string | null = null;
  try {
    bank = await bankRequest<{ accounts: Account[]; operations: Operation[] }>(
      operatorId,
      `/v1/operator/customer?id=${encodeURIComponent(incident.user_id)}`,
    );
  } catch (e) {
    bankError = e instanceof Error ? e.message : 'Bank unavailable.';
  }
  const reconciliation = reconcile(intents, bank?.operations || null);
  const gaps: string[] = [];
  if (!bank) gaps.push('Bank ledger unavailable: operations could not be verified.');
  const unreferred = intents.filter((i) => !i.bankReference).length;
  if (unreferred)
    gaps.push(`${unreferred} intent(s) have no bank reference and cannot be matched.`);
  if (!events.length) gaps.push('No agent activity was recorded for this conversation.');
  return {
    incident,
    customer: person(incident.user_id),
    lastMessage,
    history,
    events,
    intents,
    bank,
    bankError,
    reconciliation,
    gaps,
  };
}
export async function reconcileIntent(operatorId: string, caseId: string, intentId: string) {
  const current = await caseDetail(operatorId, caseId);
  const entry = current.reconciliation.find((r) => r.intentId === intentId);
  if (!entry) throw new HttpError(404, 'Intent not found.');
  if (!entry.fixable || !entry.operation)
    throw new HttpError(409, 'Nothing to reconcile for this intent.');
  const db = appDb();
  db.prepare('UPDATE intents SET status=?,operation_id=?,error=NULL WHERE id=?').run(
    'completed',
    entry.operation.id,
    intentId,
  );
  db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)').run(
    randomUUID(),
    randomUUID(),
    operatorId,
    current.incident.conversation_id,
    'intent.reconciled',
    JSON.stringify({
      intentId,
      reference: entry.reference,
      operationId: entry.operation.id,
      by: operatorId,
      previousStatus: entry.appStatus,
    }),
    new Date().toISOString(),
  );
  return caseDetail(operatorId, caseId);
}
export async function closeCase(operatorId: string, caseId: string) {
  const current = await caseDetail(operatorId, caseId);
  if (current.reconciliation.some((r) => r.fixable))
    throw new HttpError(409, 'Reconcile pending discrepancies before closing.');
  const db = appDb();
  db.prepare("UPDATE incidents SET status='closed' WHERE id=?").run(caseId);
  db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)').run(
    randomUUID(),
    randomUUID(),
    operatorId,
    current.incident.conversation_id,
    'case.closed',
    JSON.stringify({ by: operatorId }),
    new Date().toISOString(),
  );
  return caseDetail(operatorId, caseId);
}
