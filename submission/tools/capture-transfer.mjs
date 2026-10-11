// TransferCard phases capture. Usage: node capture-transfer.mjs <out-dir>
// Lucía -> Transfers: draft empty -> draft filled (Carla, 2 accounts -> pill)
// -> review -> edit back -> review -> confirm -> done -> new transfer -> overview balance.

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate';
const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-transfer.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const bank = `${ROOT}/.data/bank.sqlite`;
const balance = () =>
  execSync(`sqlite3 "${bank}" "SELECT balanceCents FROM accounts WHERE id='acc-lucia';"`)
    .toString()
    .trim();
const before = balance();
console.log(`acc-lucia balance before: ${before}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: true });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('.select-trigger[aria-label="Switch person"]').click();
await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: /^Transfers/ }).click();
await page.waitForSelector('.transfer-card.phase-draft');
await page.waitForTimeout(500);
await shot('transfer-draft-empty');
console.log('captured transfer-draft-empty.png');

// fill: person with 2 accounts -> account pill appears
await page.locator('.recipient-chip', { hasText: 'Carla' }).first().click();
await page.waitForTimeout(300);
const pills = await page.locator('.account-pill').count();
console.log(`account pills visible: ${pills}`);
if (pills) await page.locator('.account-pill').first().click();
await page.fill('input[aria-label="Amount in euros"]', '25');
await page.waitForTimeout(300);
const after = await page
  .locator('.amount-after')
  .innerText()
  .catch(() => null);
console.log(`amount-after: ${after}`);
await page.fill('input[aria-label="Description"]', 'Card check');
const submitBtn = page.locator('button.transfer-submit');
console.log(
  `submit before wait: disabled=${await submitBtn.evaluate((b) => b.disabled)} opacity=${await submitBtn.evaluate((b) => getComputedStyle(b).opacity)}`,
);
await page.waitForSelector('button.transfer-submit:not([disabled])');
await page.waitForFunction(
  () => getComputedStyle(document.querySelector('button.transfer-submit')).opacity === '1',
);
console.log(
  `submit enabled: disabled=${await submitBtn.evaluate((b) => b.disabled)} opacity=${await submitBtn.evaluate((b) => getComputedStyle(b).opacity)}`,
);
await shot('transfer-draft-filled');
console.log('captured transfer-draft-filled.png');

// review
await page.getByRole('button', { name: 'Review transfer' }).click();
await page.waitForSelector('.transfer-card.phase-review');
const review = await page.evaluate(() => ({
  code: document.querySelector('.confirmation-code')?.innerText,
  expires: document.querySelector('.transfer-card').innerText.includes('Expires in'),
}));
console.log(`review: code=${review.code} expires=${review.expires}`);
await page.waitForTimeout(400);
await shot('transfer-review');
console.log('captured transfer-review.png');

// edit back -> values preserved
await page.getByRole('button', { name: 'Edit details' }).click();
await page.waitForSelector('.transfer-card.phase-draft');
const kept = await page.locator('input[aria-label="Amount in euros"]').inputValue();
console.log(`back to draft, amount kept: ${JSON.stringify(kept)}`);
await shot('transfer-edit-back');
console.log('captured transfer-edit-back.png');

// confirm -> done
await page.getByRole('button', { name: 'Review transfer' }).click();
await page.waitForSelector('.transfer-card.phase-review');
await page.getByRole('button', { name: 'Confirm transfer' }).click();
await page.waitForSelector('.transfer-card.phase-done', { timeout: 30000 });
const done = await page.evaluate(() => ({
  sent: document.querySelector('.transfer-card').innerText.includes('SENT'),
  ref: /Reference/.test(document.querySelector('.transfer-card').innerText),
  approvalsPanel: !!document.querySelector('.panel.approvals'),
}));
console.log(`done: SENT=${done.sent} ref=${done.ref} approvalsPanel=${done.approvalsPanel}`);
await page.waitForTimeout(400);
await shot('transfer-done');
console.log('captured transfer-done.png');

// new transfer -> empty draft; overview shows reduced balance
await page.getByRole('button', { name: 'New transfer' }).click();
await page.waitForSelector('.transfer-card.phase-draft');
await page.getByRole('button', { name: /^Overview/ }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
const afterBal = balance();
console.log(
  `acc-lucia balance after: ${afterBal} (delta ${Number(before) - Number(afterBal)} cents)`,
);
await shot('overview-after-transfer');
console.log('captured overview-after-transfer.png');

await browser.close();
console.log('done');
