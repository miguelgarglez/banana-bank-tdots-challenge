// Focus modality capture. Usage: node capture-focus-modality.mjs <out-dir>
// Mouse click on text fields must NOT show the focus ring (border affordance only);
// keyboard Tab must show the 2px token ring.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-focus-modality.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const clip = async (locator, name) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box)
    await page.screenshot({
      path: path.join(out, `${name}.png`),
      clip: {
        x: Math.max(0, box.x - 10),
        y: Math.max(0, box.y - 10),
        width: Math.min(1400, box.width + 20),
        height: box.height + 20,
      },
    });
  console.log(`captured ${name}.png`);
};
const style = (sel) =>
  page.locator(sel).evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
      borderBottom: s.borderBottomColor,
    };
  });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('.select-trigger[aria-label="Switch person"]').click();
await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
await page.waitForLoadState('networkidle');

// Transfers: click amount input -> no ring, border affordance
await page.getByRole('link', { name: /^Transfers/ }).click();
await page.waitForSelector('.transfer-card.phase-draft');
await page.locator('.amount-hero-input input').click();
await page.waitForTimeout(300);
console.log('amount click:', JSON.stringify(await style('.amount-hero-input')));
await clip(page.locator('.amount-hero-input'), 'amount-click');

// keyboard: Tab from the beginning until the amount input is focused
await page.locator('body').click({ position: { x: 10, y: 10 } });
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  if (focused === 'Amount in euros') break;
}
console.log('amount tab:', JSON.stringify(await style('.amount-hero-input')));
await clip(page.locator('.amount-hero-input'), 'amount-tab');

// Chat composer: click -> no ring; Tab -> ring
await page.getByRole('link', { name: /^Assistant/ }).click();
await page.waitForSelector('.composer');
await page.locator('.composer textarea').click();
await page.waitForTimeout(300);
console.log('composer click:', JSON.stringify(await style('.composer')));
await clip(page.locator('.chat-footer'), 'composer-click');

await page.locator('body').click({ position: { x: 10, y: 10 } });
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  if (focused === 'Message the assistant') break;
}
console.log('composer tab:', JSON.stringify(await style('.composer')));
await clip(page.locator('.chat-footer'), 'composer-tab');

await browser.close();
console.log('done');
