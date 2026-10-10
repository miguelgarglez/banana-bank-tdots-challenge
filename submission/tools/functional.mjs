// Live functional check for P3.3: Lucia transfer confirm + Marta brief + reconcile.
// Usage: node tools/functional.mjs  (expects app on :3000)
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const ROOT = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate';
const app = `${ROOT}/.data/app.sqlite`;
const bank = `${ROOT}/.data/bank.sqlite`;
const sql = (db, q) => execSync(`sqlite3 "${db}" "${q}"`).toString();

sql(bank, "UPDATE scenario SET profile='normal',counter=0,read_failures=0 WHERE id=1;");
sql(app, "UPDATE intents SET status='failed' WHERE id='intent-historic-lucia';");
console.log('pre-state:', sql(app, `SELECT status FROM intents WHERE id='intent-historic-lucia';`));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const log = (s) => console.log('OK', s);

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await page.selectOption('select[aria-label="Switch person"]', 'lucia');
await page.waitForSelector('text=Your accounts at a glance');
log('lucia overview');

await page.click('button.nav-item:has-text("Transfers")');
await page.selectOption('form.transfer-form select >> nth=1', { index: 1 });
await page.fill('input[aria-label="Amount in euros"]', '25');
await page.fill('form.transfer-form label >> nth=3 >> input', 'P3 parity check');
await page.click('button:has-text("Send transfer")');
await page.waitForSelector('text=Proposals awaiting confirmation');
log('proposal panel with code visible');
await page.click('button:has-text("Confirm these details")');
await page.waitForSelector('text=Transfer confirmed and completed.');
log('transfer confirmed and completed');

await page.selectOption('select[aria-label="Switch person"]', 'marta');
await page.waitForSelector('text=Every case, a person.');
await page.click('.case-item:has-text("dinner payment")');
await page.waitForSelector('text=Latest message');
log('marta case open');
await page.click('button:has-text("Draft a brief")');
await page.waitForSelector('button:has-text("Copy reply")', { timeout: 60000 });
log('brief drafted');
await page.click('button:has-text("Apply reconciliation")');
await page.waitForSelector('text=intent.reconciled', { timeout: 15000 });
log('reconciled');
await browser.close();

sql(
  app,
  `UPDATE intents SET status='failed' WHERE id='intent-historic-lucia';
   DELETE FROM events WHERE kind='intent.reconciled' AND created_at >= datetime('now','-1 hour');`,
);
console.log(
  'restored:',
  sql(app, `SELECT id,status FROM intents WHERE id='intent-historic-lucia';`),
);
console.log('FUNCTIONAL FLOW OK');
