// Focus-ring captures for the unified --color-focus / --focus-ring-* tokens.
// Usage: node capture-focus.mjs <out-dir>   (dev server must run on :3000)
//
// Captures each text field FOCUSED at 1440x900, clipped to the field box with a
// margin, and logs getComputedStyle outline values for container + inner input.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-focus.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

async function switchPerson(name) {
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: name }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}
async function nav(label) {
  await page.getByRole('link', { name: new RegExp(`^${label}`) }).click();
  await page.waitForLoadState('networkidle');
}
async function focusField(sel) {
  const loc = page.locator(sel).first();
  await page.evaluate(() => {
    document.documentElement.dataset.focus = 'keyboard';
  });
  await loc.focus();
  // programmatic focus can miss :focus-visible; fall back to keyboard focus
  const w = await loc.evaluate(
    (el) => `${getComputedStyle(el).outlineWidth} ${getComputedStyle(el).outlineStyle}`,
  );
  if (w === '0px' || w.endsWith(' none')) {
    for (let i = 0; i < 40; i++) {
      if (await loc.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
  }
  await page.waitForTimeout(150);
  return loc;
}
async function report(sel) {
  const v = await page
    .locator(sel)
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor} offset ${cs.outlineOffset}`;
    });
  console.log(`  ${sel}: ${v}`);
}
async function shotField(loc, name, margin = 28) {
  const box = await loc.boundingBox();
  const clip = {
    x: Math.max(0, box.x - margin),
    y: Math.max(0, box.y - margin),
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
  await page.screenshot({ path: path.join(out, `${name}.png`), clip });
  console.log(`captured ${name}.png`);
}

await page.goto(BASE, { waitUntil: 'networkidle' });

// (e) persona select trigger, focused by keyboard (Tab only: mouse clicks
// would suppress :focus-visible heuristics)
await switchPerson('Lucía');
const trigger = page.locator('.select-trigger[aria-label="Switch person"]');
for (let i = 0; i < 60; i++) {
  await page.keyboard.press('Tab');
  if (await trigger.evaluate((el) => el === document.activeElement)) break;
}
await page.waitForTimeout(150);
console.log('persona select trigger:');
await report('.select-trigger[aria-label="Switch person"]');
await shotField(trigger, 'e-select-trigger-persona-focus');
await page.keyboard.press('Escape');

// (a) composer
await nav('Assistant');
await focusField('.composer textarea');
console.log('composer:');
await report('.composer');
await report('.composer textarea');
await shotField(page.locator('.composer'), 'a-chat-composer-focus');

// (b) search input
await nav('Documents');
await focusField('.search-form input');
console.log('search-form:');
await report('.search-form');
await report('.search-form input');
await shotField(page.locator('.search-form'), 'b-documents-search-focus');

// (c) transfer inputs
await nav('Transfers');
await focusField('.transfer-form input[aria-label="Amount in euros"]');
console.log('transfer amount:');
await report('.transfer-form input[aria-label="Amount in euros"]');
await shotField(
  page.locator('.transfer-field', { has: page.locator('input[aria-label="Amount in euros"]') }),
  'c-transfer-amount-focus',
);
await focusField('input[aria-label="Description"]');
console.log('transfer concept:');
await report('input[aria-label="Description"]');
await shotField(
  page.locator('.transfer-field', { has: page.locator('input[aria-label="Description"]') }),
  'c-transfer-concept-focus',
);

// (d) operator draft reply textarea
await switchPerson('Marta');
await page.locator('.case-item', { hasText: 'Lucía' }).first().click();
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: 'Draft a brief' }).click();
await page.getByRole('button', { name: 'Copy reply' }).waitFor({ timeout: 60000 });
await focusField('.brief textarea');
console.log('brief textarea:');
await report('.brief textarea');
await shotField(page.locator('.brief textarea'), 'd-operator-brief-textarea-focus');

await browser.close();
console.log('done');
