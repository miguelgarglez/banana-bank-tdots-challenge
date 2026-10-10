import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-operator-'));
process.env.DATA_DIR = temp;
process.env.BANK_DATA_DIR = temp;
process.env.BANK_PORT = '4103';
process.env.BANK_URL = 'http://127.0.0.1:4103';
const { caseDetail, reconcileIntent, closeCase } = await import('../src/operator/view');
const { runTool } = await import('../src/agent/tools');
const { appDb, closeAppDb } = await import('../src/db');
const { closeBankDb } = await import('../simulator/db');
const { seedBank } = await import('../simulator/seed');
const { setScenario } = await import('../simulator/bank');
const { seedApp } = await import('../src/seed');
const { HttpError } = await import('../src/auth');
let bank: ChildProcess;
const ctx = (userId: string) => ({
  userId,
  conversationId: 'conv-lucia-support',
  runId: randomUUID(),
  intentId: randomUUID(),
});
before(async () => {
  bank = spawn(process.execPath, ['--import', 'tsx', 'simulator/server.ts'], {
    env: process.env,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${process.env.BANK_URL}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('The bank could not be started.');
});
test('case detail shows conversation, intents and the ledger discrepancy', async () => {
  seedBank();
  setScenario('normal');
  seedApp();
  const detail = await caseDetail('marta', 'case-lucia');
  assert.equal(detail.history.length, 3);
  const intent = detail.intents.find((i) => i.id === 'intent-historic-lucia');
  assert.equal(intent?.status, 'failed');
  const entry = detail.reconciliation.find((r) => r.intentId === 'intent-historic-lucia');
  assert.equal(entry?.bankStatus, 'completed');
  assert.equal(entry?.operation?.id, 'op-historic-lucia');
  assert.equal(entry?.fixable, true);
  assert.match(entry?.finding || '', /completed operation/);
  assert.ok(detail.bank && detail.bank.accounts.length > 0);
});
test('customers cannot read case details', async () => {
  seedBank();
  seedApp();
  await assert.rejects(() => caseDetail('lucia', 'case-lucia'), HttpError);
});
test('reconciling an intent fixes the app record once', async () => {
  seedBank();
  setScenario('normal');
  seedApp();
  const detail = await reconcileIntent('marta', 'case-lucia', 'intent-historic-lucia');
  const intent = detail.intents.find((i) => i.id === 'intent-historic-lucia');
  assert.equal(intent?.status, 'completed');
  assert.equal(intent?.operationId, 'op-historic-lucia');
  assert.ok(
    detail.events.some(
      (e) =>
        (e.data as any)?.intentId === 'intent-historic-lucia' && e.kind === 'intent.reconciled',
    ),
  );
  await assert.rejects(
    () => reconcileIntent('marta', 'case-lucia', 'intent-historic-lucia'),
    /Nothing to reconcile/,
  );
});
test('closing a case with a fixable discrepancy is rejected', async () => {
  seedBank();
  setScenario('normal');
  seedApp();
  await assert.rejects(() => closeCase('marta', 'case-lucia'), /Reconcile pending discrepancies/);
  await reconcileIntent('marta', 'case-lucia', 'intent-historic-lucia');
  const detail = await closeCase('marta', 'case-lucia');
  assert.equal(detail.incident.status, 'closed');
  assert.ok(detail.events.some((e) => e.kind === 'case.closed'));
});
test('telemetry records full tool output', async () => {
  seedBank();
  seedApp();
  await runTool('list_accounts', {}, ctx('lucia'));
  const event = appDb()
    .prepare(
      "SELECT data FROM events WHERE conversation_id='conv-lucia-support' AND kind='tool.completed' ORDER BY rowid DESC LIMIT 1",
    )
    .get() as { data: string };
  const data = JSON.parse(event.data);
  assert.ok(data.output.accounts.length > 0);
  assert.equal(typeof data.durationMs, 'number');
});
test('operation_status resolves an unknown intent with a single lookup', async () => {
  seedBank();
  setScenario('normal');
  seedApp();
  appDb()
    .prepare(
      "UPDATE intents SET status='unknown',operation_id=NULL WHERE id='intent-historic-lucia'",
    )
    .run();
  const result = (await runTool(
    'operation_status',
    { reference: 'ref-historic-lucia' },
    ctx('lucia'),
  )) as any;
  assert.equal(result.status, 'completed');
  assert.equal(result.intentStatus, 'completed');
  const row = appDb()
    .prepare('SELECT status,operation_id FROM intents WHERE id=?')
    .get('intent-historic-lucia') as any;
  assert.equal(row.status, 'completed');
  assert.equal(row.operation_id, 'op-historic-lucia');
});
test('a down bank marks every intent unverified with a gap', async () => {
  seedBank();
  seedApp();
  bank.kill('SIGTERM');
  await Promise.race([
    new Promise((r) => bank.once('exit', r)),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  const detail = await caseDetail('marta', 'case-lucia');
  assert.equal(detail.bank, null);
  assert.equal(typeof detail.bankError, 'string');
  assert.ok(detail.reconciliation.every((r) => r.bankStatus === 'unverified'));
  assert.ok(detail.gaps.some((g) => /unavailable/.test(g)));
});
after(async () => {
  if (bank.exitCode === null) {
    bank.kill('SIGTERM');
    await Promise.race([
      new Promise((r) => bank.once('exit', r)),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    if (bank.exitCode === null) bank.kill('SIGKILL');
  }
  closeAppDb();
  closeBankDb();
  fs.rmSync(temp, { recursive: true, force: true });
});
