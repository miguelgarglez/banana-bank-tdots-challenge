// Visual parity capture for Banana Bank P3 refactor.
// Usage: node tools/parity.mjs <out-dir>
//
// Determinism normalization before capturing (the app dev server must be running on 3000):
//   - app.sqlite: deletes today's (UTC date) unconsumed approvals (no created_at column;
//     expires_at = created+10min is the proxy) and non-'completed' intents,
//     plus today's lucia conversations with their messages/runs/events, so leftover
//     interactive verification state does not leak into the screenshots.
//   - bank sqlite: scenario profile -> 'normal', counter/read_failures -> 0,
//     so the dashboard reads don't flicker between capture runs.
//   - browser: fixed 1440x900 viewport, deviceScaleFactor 1, reducedMotion 'reduce',
//     networkidle + 400ms settle per shot, fullPage.

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate';
const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: parity.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const app = `${ROOT}/.data/app.sqlite`;
const bank = `${ROOT}/.data/bank.sqlite`;
const sql = (db, q) => execSync(`sqlite3 "${db}" "${q}"`).toString();

sql(app, `DELETE FROM approvals WHERE consumed_at IS NULL AND date(expires_at)=date('now');`);
sql(app, `DELETE FROM intents WHERE status!='completed' AND date(created_at)=date('now');`);
// case-lucia view is part of the reference: force the state it was captured in
// (intent completed = reconciled; exactly one copilot.brief event, the earliest)
sql(app, `UPDATE intents SET status='completed' WHERE id='intent-historic-lucia';`);
sql(
  app,
  `DELETE FROM events WHERE kind='copilot.brief' AND id NOT IN
     (SELECT id FROM events WHERE kind='copilot.brief' ORDER BY created_at LIMIT 1);`,
);
sql(app, `DELETE FROM events WHERE kind='intent.reconciled';`);
const todayConvs = sql(
  app,
  `SELECT id FROM conversations WHERE user_id='lucia' AND date(created_at)=date('now');`,
)
  .split('\n')
  .filter(Boolean);
for (const id of todayConvs) {
  sql(app, `DELETE FROM messages WHERE conversation_id='${id}';`);
  sql(app, `DELETE FROM runs WHERE conversation_id='${id}';`);
  sql(app, `DELETE FROM events WHERE conversation_id='${id}';`);
  sql(app, `DELETE FROM conversations WHERE id='${id}';`);
}
sql(bank, "UPDATE scenario SET profile='normal',counter=0,read_failures=0 WHERE id=1;");
console.log(
  `normalized: ${todayConvs.length} conversations removed; intents/approvals cleaned; bank=normal`,
);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();

async function person(id) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.selectOption('select[aria-label="Switch person"]', id);
  await page.waitForLoadState('networkidle');
}
async function nav(label) {
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await page.waitForLoadState('networkidle');
}
async function shot(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  console.log(`captured ${name}.png`);
}

await person('lucia');
await shot('lucia-overview');

await nav('Assistant');
await page.getByRole('button', { name: 'Dinner payment' }).click();
await page.waitForLoadState('networkidle');
await shot('lucia-chat-dinner');

await nav('Transfers');
const contacts = await page.$$eval(
  '.transfer-form select option',
  (els) => els.map((e) => ({ v: e.value, t: e.textContent })),
);
const bruno = contacts.find((o) => /Bruno/i.test(o.t));
if (!bruno) throw new Error('Bruno contact not found');
await page.locator('.transfer-form select').nth(1).selectOption(bruno.v);
await page.getByLabel('Amount in euros').fill('85');
await page.locator('.transfer-form label', { hasText: 'Description' }).locator('input').fill('Team dinner');
await shot('lucia-transfers');

await nav('Documents');
await shot('lucia-documents');
await page.getByRole('button', { name: /Aurora · current fees/ }).click();
await page.waitForLoadState('networkidle');
await shot('lucia-document-open');

await person('marta');
await shot('marta-cases');
await page.locator('.case-item', { hasText: 'Lucía' }).first().click();
await page.waitForLoadState('networkidle');
await shot('marta-case-lucia');

await nav('Documents');
await shot('marta-documents');

await browser.close();
console.log('done');
