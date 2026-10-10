import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-approvals-'));
process.env.DATA_DIR = temp;
process.env.BANK_DATA_DIR = temp;
process.env.BANK_PORT = '4102';
process.env.BANK_URL = 'http://127.0.0.1:4102';
const { transferMoney } = await import('../src/banking/actions');
const { authorizeTransfer } = await import('../src/banking/authorization');
const { runTool } = await import('../src/agent/tools');
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
const ctx = (intentId: string, userId = 'lucia', extra: Record<string, unknown> = {}) => ({
  userId,
  conversationId: null,
  runId: randomUUID(),
  intentId,
  ...extra,
});
const operations = () =>
  bankDb().prepare("SELECT * FROM operations WHERE concept='Test'").all() as any[];
const approval = (id: string) =>
  appDb().prepare('SELECT * FROM approvals WHERE id=?').get(id) as any;
const intent = (id: string) => appDb().prepare('SELECT * FROM intents WHERE id=?').get(id) as any;
const resetApp = () => appDb().exec('DELETE FROM approvals; DELETE FROM intents;');
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
test('a transfer proposal does not move money', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID();
  const result = await transferMoney(ctx(intentId), input);
  assert.equal(result.status, 'requires_confirmation');
  assert.equal(operations().length, 0);
  const row = approval((result as any).approvalId);
  assert.equal(row.intent_id, intentId);
  assert.equal(intent(intentId).status, 'awaiting_confirmation');
  assert.equal((result as any).proposal.amountCents, 1000);
  assert.equal((result as any).proposal.toName, 'Bruno Vidal');
});
test('confirming a proposal completes it exactly once', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  const result = await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(result.status, 'completed');
  assert.equal(operations().length, 1);
  assert.ok(approval(proposal.approvalId).consumed_at);
  assert.equal(intent(intentId).status, 'completed');
});
test('a completed intent replays instead of charging again', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  const first = (await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  )) as any;
  const again = (await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  )) as any;
  assert.equal(again.status, 'completed');
  assert.equal(again.replay, true);
  assert.equal(again.operation.id, first.operation.id);
  assert.equal(operations().length, 1);
});
test('a proposal does not confirm altered details', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  const result = await authorizeTransfer(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId }),
    {
      ...input,
      amountCents: 1200,
    },
  );
  assert.equal(result?.status, 'failed');
  assert.match((result as any).error, /does not match/);
  assert.equal(operations().length, 0);
});
test('an expired proposal is rejected', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  appDb()
    .prepare('UPDATE approvals SET expires_at=? WHERE id=?')
    .run('2000-01-01T00:00:00.000Z', proposal.approvalId);
  const result = await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(result.status, 'failed');
  assert.match((result as any).error, /expired/);
  assert.equal(operations().length, 0);
  assert.equal(intent(intentId).status, 'expired');
});
test('confirmation in the same run as the proposal is rejected', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID(),
    base = ctx(intentId);
  const proposal = (await transferMoney(base, input)) as any;
  const result = await transferMoney({ ...base, approvalId: proposal.approvalId }, input);
  assert.equal(result.status, 'failed');
  assert.match((result as any).error, /later message/);
  assert.equal(operations().length, 0);
});
test('a proposal cannot be confirmed by another person', async () => {
  seedBank();
  resetApp();
  setScenario('normal');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  const result = (await runTool(
    'confirm_transfer',
    { approvalId: proposal.approvalId },
    ctx(randomUUID(), 'bruno'),
  )) as any;
  assert.equal(result.status, 'failed');
  assert.match(result.error, /not found/);
  assert.equal(operations().length, 0);
});
test('an unknown transfer can be confirmed again to resolution', async () => {
  seedBank();
  resetApp();
  setScenario('read-unavailable');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  assert.equal(proposal.status, 'requires_confirmation');
  const first = await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(first.status, 'unknown');
  assert.equal(operations().length, 1);
  const second = await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(second.status, 'completed');
  assert.equal(operations().length, 1);
});
test('an expired approval over an unknown intent still confirms', async () => {
  seedBank();
  resetApp();
  setScenario('read-unavailable');
  const intentId = randomUUID();
  const proposal = (await transferMoney(ctx(intentId), input)) as any;
  const first = await transferMoney(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(first.status, 'unknown');
  appDb()
    .prepare('UPDATE approvals SET expires_at=? WHERE id=?')
    .run('2000-01-01T00:00:00.000Z', proposal.approvalId);
  const permission = await authorizeTransfer(
    ctx(intentId, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(permission, null);
  const resolved = await transferMoney(ctx(intentId), input);
  assert.equal(resolved.status, 'completed');
  assert.notEqual(intent(intentId).status, 'expired');
  assert.equal(operations().length, 1);
});
test('an identical proposal is blocked while another is unverified', async () => {
  seedBank();
  resetApp();
  setScenario('read-unavailable');
  const first = randomUUID();
  const proposal = (await transferMoney(ctx(first), input)) as any;
  await transferMoney(
    ctx(first, 'lucia', { approvalId: proposal.approvalId, confirmedBy: 'click' }),
    input,
  );
  assert.equal(intent(first).status, 'unknown');
  bank.kill('SIGTERM');
  await Promise.race([
    new Promise((r) => bank.once('exit', r)),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  const secondId = randomUUID();
  const second = (await transferMoney(ctx(secondId), input)) as any;
  assert.equal(second.status, 'blocked');
  assert.equal(second.intentId, first);
  assert.equal(intent(secondId).status, 'blocked');
  assert.equal((appDb().prepare('SELECT COUNT(*) n FROM approvals').get() as { n: number }).n, 1);
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
