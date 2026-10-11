import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-drafts-'));
process.env.DATA_DIR = temp;
process.env.BANK_DATA_DIR = temp;
process.env.BANK_PORT = '4102';
process.env.BANK_URL = 'http://127.0.0.1:4102';
const { runTool, toolDefinitions } = await import('../src/agent/tools');
const { transferMoney } = await import('../src/banking/actions');
const { dismissProposal } = await import('../src/banking/authorization');
const { transferAttachments } = await import('../src/banking/attachments');
const { appDb, closeAppDb } = await import('../src/db');
const { closeBankDb } = await import('../simulator/db');
const { seedBank } = await import('../simulator/seed');
const { setScenario } = await import('../simulator/bank');
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
test('draft_transfer validates ids against the real accounts and only records an event', async () => {
  seedBank();
  setScenario('normal');
  const result = (await runTool(
    'draft_transfer',
    { fromAccountId: 'acc-lucia', toAccountId: 'acc-fake', amountCents: 5000, concept: null },
    { userId: 'lucia', conversationId: 'conv-x', runId: randomUUID(), intentId: randomUUID() },
  )) as any;
  assert.equal(result.status, 'draft');
  assert.equal(result.draft.toAccountId, null);
  assert.equal(result.draft.fromAccountId, 'acc-lucia');
  assert.equal(result.draft.amountCents, 5000);
  const event = appDb().prepare("SELECT data FROM events WHERE kind='transfer.drafted'").get() as {
    data: string;
  };
  assert.ok(event);
  assert.equal(JSON.parse(event.data).draftId, result.draftId);
  assert.equal((appDb().prepare('SELECT COUNT(*) n FROM intents').get() as { n: number }).n, 0);
  assert.equal((appDb().prepare('SELECT COUNT(*) n FROM approvals').get() as { n: number }).n, 0);
});
test('transferAttachments anchors drafts and intents to the run that created them', async () => {
  seedBank();
  setScenario('normal');
  const db = appDb();
  const conv = 'conv-attach';
  const runId = 'run-attach-1';
  const draftId = 'draft-attach-1';
  db.prepare('INSERT INTO conversations VALUES(?,?,?,?)').run(
    conv,
    'lucia',
    'Attach test',
    new Date().toISOString(),
  );
  db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(
    randomUUID(),
    conv,
    'assistant',
    'Here is the card.',
    new Date().toISOString(),
    runId,
  );
  db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)').run(
    randomUUID(),
    runId,
    'lucia',
    conv,
    'transfer.drafted',
    JSON.stringify({
      draftId,
      draft: {
        fromAccountId: null,
        toAccountId: 'acc-bruno',
        amountCents: null,
        concept: null,
      },
    }),
    new Date().toISOString(),
  );
  let attachments = transferAttachments('lucia', conv);
  assert.deepEqual(
    attachments.get(runId)?.map((a) => [a.kind, a.id]),
    [['draft', draftId]],
  );
  const input = {
    fromAccountId: 'acc-lucia',
    toAccountId: 'acc-bruno',
    amountCents: 700,
    concept: 'Attach',
  };
  const proposal = (await transferMoney(
    {
      userId: 'lucia',
      conversationId: conv,
      runId: 'other-run',
      intentId: draftId,
    },
    input,
  )) as any;
  assert.equal(proposal.status, 'requires_confirmation');
  attachments = transferAttachments('lucia', conv);
  const anchored = attachments.get(runId);
  assert.equal(anchored?.length, 1);
  const intentAtt = anchored![0];
  assert.equal(intentAtt.kind, 'intent');
  assert.equal(intentAtt.id, draftId);
  if (intentAtt.kind === 'intent') {
    assert.equal(intentAtt.status, 'awaiting_confirmation');
    assert.ok(intentAtt.approval);
    assert.equal(intentAtt.approval!.confirmationCode.length, 6);
  }
  await dismissProposal('lucia', proposal.approvalId);
  attachments = transferAttachments('lucia', conv);
  const cancelled = attachments.get(runId)![0];
  if (cancelled.kind === 'intent') {
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.approval, null);
  } else assert.fail('expected intent attachment');
});
test('toolDefinitions exposes draft_transfer as a strict tool', () => {
  const tool = toolDefinitions.find((t) => t.name === 'draft_transfer') as any;
  assert.ok(tool);
  assert.equal(tool.strict, true);
  assert.deepEqual(tool.parameters.required, [
    'fromAccountId',
    'toAccountId',
    'amountCents',
    'concept',
  ]);
});
after(async () => {
  if (bank && bank.exitCode === null) {
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
