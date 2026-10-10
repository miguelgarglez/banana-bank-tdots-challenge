import { appDb } from '../db';
import { bankRequest } from '../banking/client';
import { resolveIntent } from '../banking/resolve';
import { confirmationCode } from '../banking/authorization';
import { defineRoute } from './router';

export const dashboardRoutes = [
  defineRoute('ANY', 'dashboard', 'any', async ({ json, current }) => {
    const db = appDb();
    if (current!.role === 'operator')
      return json({
        incidents: db.prepare('SELECT * FROM incidents ORDER BY created_at DESC').all(),
      });
    for (const i of db
      .prepare("SELECT id FROM intents WHERE user_id=? AND status='unknown'")
      .all(current!.id) as { id: string }[])
      await resolveIntent(current!.id, i.id);
    const [accounts, movements, contacts] = await Promise.all([
      bankRequest(current!.id, '/v1/accounts'),
      bankRequest(current!.id, '/v1/movements'),
      bankRequest(current!.id, '/v1/contacts'),
    ]);
    const approvals = (
      db
        .prepare('SELECT * FROM approvals WHERE user_id=? AND consumed_at IS NULL AND expires_at>?')
        .all(current!.id, new Date().toISOString()) as any[]
    ).map((a) => ({
      ...a,
      payload: JSON.parse(a.payload),
      confirmationCode: confirmationCode(a.id),
    }));
    const pendingOperations = (
      db
        .prepare(
          "SELECT id,bank_reference,payload,error,created_at FROM intents WHERE user_id=? AND status='unknown'",
        )
        .all(current!.id) as any[]
    ).map((i) => ({
      intentId: i.id,
      reference: i.bank_reference,
      payload: JSON.parse(i.payload),
      createdAt: i.created_at,
      error: i.error,
    }));
    return json({ accounts, movements, contacts, approvals, pendingOperations });
  }),
];
