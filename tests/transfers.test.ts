import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-transfers-'));
process.env.DATA_DIR = temp;
process.env.BANK_DATA_DIR = temp;
process.env.BANK_PORT = '4101';
process.env.BANK_URL = 'http://127.0.0.1:4101';
const { transferMoney } = await import('../src/banking/actions');
const { appDb, closeAppDb } = await import('../src/db');
const { bankDb, closeBankDb } = await import('../simulator/db');
const { seedBank } = await import('../simulator/seed');
const { setScenario } = await import('../simulator/bank');
const input = {
  fromAccountId: 'acc-lucia',
  toAccountId: 'acc-bruno',
  amountCents: 1000,
  concept: 'Test',
};
const ctx = (intentId: string, userId = 'lucia') => ({
  userId,
  conversationId: null,
  runId: randomUUID(),
  intentId,
});
const operations = () =>
  bankDb().prepare("SELECT * FROM operations WHERE concept='Test'").all() as any[];
const balance = (id: string) =>
  (
    bankDb().prepare('SELECT balanceCents FROM accounts WHERE id=?').get(id) as {
      balanceCents: number;
    }
  ).balanceCents;
const intent = (id: string) => appDb().prepare('SELECT * FROM intents WHERE id=?').get(id) as any;
let bank: ChildProcess;
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
for (const scenario of ['lost-response', 'slow-response'] as const)
  test(`${scenario}: one transfer commits exactly once`, async () => {
    seedBank();
    setScenario(scenario);
    const intentId = randomUUID(),
      before = balance('acc-lucia');
    const result = await transferMoney(ctx(intentId), input);
    assert.equal(result.status, 'completed');
    assert.equal(operations().length, 1);
    assert.equal(balance('acc-lucia'), before - 1000);
    assert.equal(intent(intentId).status, 'completed');
    assert.equal(intent(intentId).bank_reference, operations()[0].reference);
  });
test('reject-before: retry reuses the same reference', async () => {
  seedBank();
  setScenario('reject-before');
  const intentId = randomUUID();
  const result = await transferMoney(ctx(intentId), input);
  assert.equal(result.status, 'completed');
  assert.equal(operations().length, 1);
  assert.equal(intent(intentId).bank_reference, operations()[0].reference);
});
test('read-unavailable: unknown status resolves on replay', async () => {
  seedBank();
  setScenario('read-unavailable');
  const intentId = randomUUID();
  const first = await transferMoney(ctx(intentId), input);
  assert.equal(first.status, 'unknown');
  assert.equal(operations().length, 1);
  assert.equal(intent(intentId).status, 'unknown');
  assert.equal(intent(intentId).bank_reference, operations()[0].reference);
  const second = await transferMoney(ctx(intentId), input);
  assert.equal(second.status, 'completed');
  assert.equal(operations().length, 1);
  assert.equal(intent(intentId).status, 'completed');
});
test('intermittent seed 17: three transfers complete with three operations', async () => {
  seedBank();
  setScenario('intermittent', 17);
  const before = balance('acc-lucia');
  for (let i = 0; i < 3; i++) {
    const result = await transferMoney(ctx(randomUUID()), input);
    assert.equal(result.status, 'completed');
  }
  assert.equal(operations().length, 3);
  assert.equal(balance('acc-lucia'), before - 3000);
});
test('insufficient funds fail without new operations', async () => {
  seedBank();
  setScenario('normal');
  const intentId = randomUUID();
  const result = await transferMoney(ctx(intentId, 'diego'), {
    ...input,
    fromAccountId: 'acc-diego',
    amountCents: 10000,
  });
  assert.equal(result.status, 'failed');
  assert.equal(operations().length, 0);
  assert.equal(intent(intentId).status, 'failed');
});
after(async () => {
  bank.kill('SIGTERM');
  await Promise.race([
    new Promise((r) => bank.once('exit', r)),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  if (bank.exitCode === null) bank.kill('SIGKILL');
  closeAppDb();
  closeBankDb();
  fs.rmSync(temp, { recursive: true, force: true });
});
