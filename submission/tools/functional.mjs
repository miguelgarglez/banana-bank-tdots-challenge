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

async function switchPerson(name) {
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: name }).first().click();
  await page.waitForLoadState('networkidle');
}

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await switchPerson('Lucía');
await page.waitForSelector('text=Your accounts at a glance');
log('lucia overview');

await page.click('button.nav-item:has-text("Transfers")');
const chip = page.locator('.recipient-chip', { hasText: 'Bruno' }).first();
if (await chip.isVisible().catch(() => false)) await chip.click();
else await page.locator('.recipient-chip').first().click();
await page.waitForTimeout(300);
if (await page.locator('.account-pill').first().isVisible())
  await page.locator('.account-pill').first().click();
await page.fill('input[aria-label="Amount in euros"]', '25');
await page.fill('input[aria-label="Description"]', 'P3 parity check');
await page.click('button:has-text("Review transfer")');
await page.waitForSelector('.transfer-card.phase-review .confirmation-code');
log('transfer card in review with code visible');
await page.click('button:has-text("Confirm transfer")');
await page.waitForSelector('.transfer-card.phase-done');
log('transfer done (card confirmed)');

await switchPerson('Marta');
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
