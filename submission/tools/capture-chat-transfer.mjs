// Chat-integrated transfer card capture. Usage: node capture-chat-transfer.mjs <out-dir>
// Fixture: conv-chat-transfer (lucia) with a transfer.drafted event anchored to run-ct-1.
// Cleanup in finally. Step 5 makes ONE real LLM call (allowed).

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate';
const BASE = 'http://127.0.0.1:3000';
const DB = `${ROOT}/.data/app.sqlite`;
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-chat-transfer.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const sql = (q) => execFileSync('sqlite3', [DB, q]).toString().trim();
const CONV = 'conv-chat-transfer';
const RUN = 'run-ct-1';
const DRAFT = 'draft-ct-1';

function insertFixture() {
  const now = new Date().toISOString();
  sql(
    `INSERT OR REPLACE INTO conversations VALUES('${CONV}','lucia','Chat transfer check','${now}');`,
  );
  sql(
    `INSERT INTO messages VALUES('${randomUUID()}','${CONV}','user','quiero enviar dinero a Carla','${now}','${RUN}');`,
  );
  sql(
    `INSERT INTO messages VALUES('${randomUUID()}','${CONV}','assistant','I prepared the transfer to Carla; fill in the amount and review it.','${now}','${RUN}');`,
  );
  sql(
    `INSERT INTO events VALUES('${randomUUID()}','${RUN}','lucia','${CONV}','transfer.drafted','{"draftId":"${DRAFT}","draft":{"fromAccountId":null,"toAccountId":"acc-carla","amountCents":null,"concept":null}}','${now}');`,
  );
}
function cleanup() {
  sql(`DELETE FROM messages WHERE conversation_id='${CONV}';`);
  sql(`DELETE FROM events WHERE conversation_id='${CONV}';`);
  sql(`DELETE FROM approvals WHERE intent_id='${DRAFT}';`);
  sql(`DELETE FROM intents WHERE id='${DRAFT}';`);
  sql(`DELETE FROM conversations WHERE id='${CONV}';`);
  console.log('fixture cleaned');
}

insertFixture();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: true });

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: /^Assistant/ }).click();
  await page.getByRole('combobox', { name: 'Conversation' }).click();
  await page.locator('.select-option', { hasText: 'Chat transfer check' }).click();
  await page.waitForSelector('.chat-transfer .transfer-card.phase-draft');
  const draftState = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('.chat-transfer .recipient-chip')].map(
      (b) => `${b.textContent.trim()}:${b.getAttribute('aria-pressed')}`,
    ),
    heroFont: getComputedStyle(document.querySelector('.chat-transfer .amount-hero-input input'))
      .fontSize,
  }));
  console.log(
    `draft card: chips=${JSON.stringify(draftState.chips)} heroFont=${draftState.heroFont}`,
  );
  await page.waitForTimeout(400);
  await shot('chat-draft');
  console.log('captured chat-draft.png');

  await page.fill('.chat-transfer input[aria-label="Amount in euros"]', '12');
  await page.fill('.chat-transfer input[aria-label="Description"]', 'Chat card check');
  await page.locator('.chat-transfer button.transfer-submit').click();
  await page.waitForSelector('.chat-transfer .transfer-card.phase-review');
  const placeholder = await page
    .locator('textarea[aria-label="Message the assistant"]')
    .getAttribute('placeholder');
  console.log(`review card shown; composer placeholder: ${JSON.stringify(placeholder)}`);
  await page.waitForTimeout(400);
  await shot('chat-review');
  console.log('captured chat-review.png');

  await page.locator('.chat-transfer .primary-button', { hasText: 'Confirm' }).click();
  await page.waitForSelector('.chat-transfer .transfer-card.phase-done', { timeout: 30000 });
  const done = await page.evaluate(() => ({
    sent: document.querySelector('.chat-transfer .transfer-card').innerText.includes('SENT'),
    ref: /Reference/.test(document.querySelector('.chat-transfer .transfer-card').innerText),
  }));
  const intentStatus = sql(`SELECT status FROM intents WHERE id='${DRAFT}';`);
  console.log(`done: SENT=${done.sent} ref=${done.ref} intent ${DRAFT} status=${intentStatus}`);
  await page.waitForTimeout(400);
  await shot('chat-done');
  console.log('captured chat-done.png');

  // reload: done card must stay anchored to the same assistant message
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: /^Assistant/ }).click();
  await page.getByRole('combobox', { name: 'Conversation' }).click();
  await page.locator('.select-option', { hasText: 'Chat transfer check' }).click();
  await page.waitForSelector('.chat-transfer .transfer-card.phase-done');
  const anchored = await page.evaluate(() => {
    const card = document.querySelector('.chat-transfer .transfer-card');
    const msg = card.closest('.message.assistant');
    return {
      anchored: !!msg,
      text: msg?.querySelector('.bubble')?.innerText.slice(0, 60),
    };
  });
  console.log(`reload: anchored=${anchored.anchored} under "${anchored.text}"`);
  await page.waitForTimeout(400);
  await shot('chat-done-reload');
  console.log('captured chat-done-reload.png');

  // ONE real LLM call: fresh conversation, ambiguous transfer request
  await page.getByRole('button', { name: '+ New conversation' }).click();
  await page.fill(
    'textarea[aria-label="Message the assistant"]',
    'quiero mandarle 20 euros a Bruno',
  );
  await page.locator('button[aria-label="Send message"]').click();
  await page.waitForSelector('.message.assistant .bubble', { timeout: 60000 });
  await page.waitForSelector('.thinking', { state: 'detached', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const reply = await page.locator('.message.assistant .bubble').last().innerText();
  const hasDraftCard = await page.locator('.chat-transfer .transfer-card.phase-draft').count();
  const chipPressed = await page.evaluate(
    () =>
      [...document.querySelectorAll('.chat-transfer .recipient-chip')]
        .find((b) => b.getAttribute('aria-pressed') === 'true')
        ?.textContent.trim() ?? null,
  );
  const draftAmount = await page
    .locator('.chat-transfer input[aria-label="Amount in euros"]')
    .inputValue()
    .catch(() => null);
  const tools = sql(
    `SELECT json_extract(data,'$.tool') FROM events WHERE kind='tool.started' AND conversation_id=(SELECT id FROM conversations WHERE user_id='lucia' ORDER BY created_at DESC LIMIT 1);`,
  );
  const draftArgs = sql(
    `SELECT json_extract(data,'$.arguments') FROM events WHERE kind='tool.started' AND json_extract(data,'$.tool')='draft_transfer' AND conversation_id=(SELECT id FROM conversations WHERE user_id='lucia' ORDER BY created_at DESC LIMIT 1);`,
  );
  console.log(`LLM reply: ${JSON.stringify(reply)}`);
  console.log(
    `draft card after LLM: ${hasDraftCard} preselected=${chipPressed} amount=${draftAmount} tools=${tools} draftArgs=${draftArgs}`,
  );
  await shot('chat-llm-draft');
  console.log('captured chat-llm-draft.png');
} finally {
  await browser.close();
  cleanup();
}
console.log('done');
