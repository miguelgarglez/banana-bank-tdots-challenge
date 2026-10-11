// Operator view redesign check: inbox segments, ledger check, timeline, copilot brief.
// Usage: node tools/capture-operator.mjs  (expects app on :3000)
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = `${ROOT}/.data/app.sqlite`;
const bank = `${ROOT}/.data/bank.sqlite`;
const sql = (db, q) => execSync(`sqlite3 "${db}" "${q}"`).toString();
const out = path.join(ROOT, 'submission', 'evidencias', 'despues', '32-operator');
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'OK ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  console.log(results[results.length - 1]);
};

sql(bank, "UPDATE scenario SET profile='normal',counter=0,read_failures=0 WHERE id=1;");
sql(app, "UPDATE intents SET status='failed' WHERE id='intent-historic-lucia';");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: true });

try {
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: 'Marta' }).first().click();
  await page.waitForURL('**/cases', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.case-item', { timeout: 15000 });

  // inbox segments
  check('inbox open rows', (await page.locator('.case-item').count()) > 0);
  const openCount = await page.locator('.case-item').count();
  await shot('inbox-open');
  await page.locator('.segment', { hasText: 'Resolved' }).click();
  await page.waitForTimeout(400);
  const resolvedLabel = await page
    .locator('.segment', { hasText: 'Resolved' })
    .innerText();
  const resolvedRows = await page.locator('.case-item').count();
  const segmentCount = parseInt(resolvedLabel.match(/\d+/)?.[0] ?? '-1', 10);
  check(
    'resolved count matches',
    segmentCount === resolvedRows,
    `label="${resolvedLabel.trim().replace(/\n/g, ' ')}" rows=${resolvedRows}`,
  );
  await shot('inbox-resolved');
  await page.locator('.segment', { hasText: 'Open' }).click();
  await page.waitForTimeout(300);

  // open the dinner payment case
  await page.locator('.case-item', { hasText: 'dinner payment' }).first().click();
  await page.waitForURL('**/cases/**', { timeout: 10000 });
  await page.waitForSelector('.timeline', { timeout: 15000 });
  await page.waitForTimeout(600);
  check('ledger-check present', await page.locator('.ledger-check').isVisible());
  check(
    'warning glyph + apply button',
    (await page.locator('.ledger-glyph.warning').count()) > 0 &&
      (await page.locator('button:has-text("Apply reconciliation")').isVisible()),
  );
  const labels = await page.locator('.tl-event .tl-label').allInnerTexts();
  console.log('timeline labels:', JSON.stringify(labels));
  check('timeline has events', labels.length > 0, `${labels.length} events`);
  check(
    'messages in timeline',
    (await page.locator('.tl-message').count()) > 0,
  );
  const pageFits = await page.evaluate(
    () => document.documentElement.scrollHeight <= window.innerHeight,
  );
  check('detail fits viewport (panels scroll)', pageFits);
  await shot('case-detail');

  // copilot brief (one real LLM call)
  await page.getByRole('button', { name: 'Draft a brief' }).click();
  await page.waitForSelector('.brief-card', { timeout: 90000 });
  const ta = page.locator('.brief-card textarea');
  await ta.fill((await ta.inputValue()) + ' — edited');
  await page.getByRole('button', { name: 'Copy reply' }).click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check('clipboard has edit', clip.endsWith(' — edited'), clip.slice(-30));
  await shot('case-brief');

  // reconciliation
  await page.getByRole('button', { name: 'Apply reconciliation' }).click();
  await page.waitForSelector('text=Reconciled by operator', { timeout: 15000 });
  await page.waitForTimeout(300);
  check('reconciled in timeline', true);
  check(
    'row now green check',
    (await page.locator('.ledger-glyph.positive').count()) > 0,
  );
  await shot('case-reconciled');
} finally {
  sql(app, "UPDATE intents SET status='failed' WHERE id='intent-historic-lucia';");
  sql(
    app,
    `DELETE FROM events WHERE kind='intent.reconciled' AND created_at >= datetime('now','-1 hour');`,
  );
  console.log('restored: intent-historic-lucia|failed');
  await browser.close();
}
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${fails.length ? `${fails.length} FAILURES` : 'ALL CHECKS OK'} → ${out}`);
process.exit(fails.length ? 1 : 0);
