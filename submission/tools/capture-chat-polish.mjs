// Chat polish verification: contrast, empty state fit, header/footer + textarea autogrow.
// Usage: node capture-chat-polish.mjs <out-dir>   (dev server on :3000)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-chat-polish.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function clipShot(sel, name, margin = 16) {
  const loc = page.locator(sel).first();
  const box = await loc.boundingBox();
  await page.screenshot({
    path: path.join(out, `${name}.png`),
    clip: {
      x: Math.max(0, box.x - margin),
      y: Math.max(0, box.y - margin),
      width: box.width + margin * 2,
      height: box.height + margin * 2,
    },
  });
  console.log(`captured ${name}.png`);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('.select-trigger[aria-label="Switch person"]').click();
await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
await page.waitForLoadState('networkidle');
await page.getByRole('link', { name: /^Assistant/ }).click();
await page.waitForLoadState('networkidle');
await page.locator('.select-trigger[aria-label="Conversation"]').click();
await page
  .locator('.select-option', { hasText: 'Send 7 euros to Bruno for coffee' })
  .first()
  .click();
await page.waitForTimeout(700);

// 1) bubble text contrast
const colors = await page.evaluate(() => ({
  user: getComputedStyle(document.querySelector('.message.user .bubble .markdown p')).color,
  assistant: getComputedStyle(document.querySelector('.message.assistant .bubble .markdown p'))
    .color,
}));
console.log(`user p color=${colors.user} (expect rgb(255, 255, 255))`);
console.log(`assistant p color=${colors.assistant} (expect rgb(23, 43, 43))`);
async function clipLast(sel, name, margin = 16) {
  const loc = page.locator(sel).last();
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  await page.screenshot({
    path: path.join(out, `${name}.png`),
    clip: {
      x: Math.max(0, box.x - margin),
      y: Math.max(0, box.y - margin),
      width: box.width + margin * 2,
      height: box.height + margin * 2,
    },
  });
  console.log(`captured ${name}.png`);
}
await clipLast('.message.user .bubble', 'bubble-user');
await clipLast('.message.assistant .bubble', 'bubble-assistant');

// 2) empty state fits without inner scroll
for (const [w, h, name] of [
  [1440, 900, 'chat-empty-1440x900'],
  [1100, 800, 'chat-empty-1100x800'],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.getByRole('button', { name: '+ New conversation' }).click();
  await page.waitForTimeout(600);
  const fit = await page.evaluate(() => {
    const m = document.querySelector('.messages');
    return { scrollH: m.scrollHeight, clientH: m.clientHeight };
  });
  console.log(
    `${name}: .messages scrollH=${fit.scrollH} clientH=${fit.clientH} fits=${fit.scrollH <= fit.clientH}`,
  );
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  console.log(`captured ${name}.png`);
}

// 3) header + footer clips, textarea focus ring and autogrow
await page.setViewportSize({ width: 1440, height: 900 });
await clipShot('.chat-header', 'chat-header', 10);
const ta = page.locator('.composer textarea');
await ta.focus();
await page.waitForTimeout(150);
const ring = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.composer'));
  return `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor} offset ${cs.outlineOffset}`;
});
console.log(`composer:focus-within outline = ${ring}`);
await clipShot('.chat-footer', 'chat-footer-focused', 10);
const h0 = await ta.evaluate((el) => el.getBoundingClientRect().height);
await ta.type('a');
await page.keyboard.press('Shift+Enter');
await ta.type('b');
await page.keyboard.press('Shift+Enter');
await ta.type('c');
await page.waitForTimeout(150);
const h1 = await ta.evaluate((el) => el.getBoundingClientRect().height);
console.log(
  `textarea height before=${Math.round(h0)} after 3 lines=${Math.round(h1)} grew=${h1 > 36}`,
);
await clipShot('.chat-footer', 'chat-footer-multiline', 10);

await browser.close();
console.log('done');
