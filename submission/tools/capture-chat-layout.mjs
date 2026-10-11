// Chat fixed-viewport layout verification.
// Usage: node capture-chat-layout.mjs <out-dir>   (dev server on :3000)
//
// For persona Lucía, Assistant tab, checks at 1440x900 / 1100x800 / 820x700:
//   - no page scroll (documentElement fits viewport, scrollTo is a no-op)
//   - .messages scrolls internally (scrollHeight > clientHeight, overflowY auto)
//   - .composer fully inside the viewport
//   - autoscroll lands near the bottom of .messages
// Plus PNGs: one per size, an empty conversation, and Overview (normal scroll).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-chat-layout.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function measure(tag) {
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const msg = document.querySelector('.messages');
    const comp = document.querySelector('.composer');
    window.scrollTo(0, 9999);
    return {
      innerH: window.innerHeight,
      docScrollH: document.documentElement.scrollHeight,
      pageScrollTop: document.scrollingElement.scrollTop,
      msgScrollH: msg?.scrollHeight,
      msgClientH: msg?.clientHeight,
      msgOverflowY: msg ? getComputedStyle(msg).overflowY : null,
      msgScrollTop: msg?.scrollTop,
      composerBottom: comp?.getBoundingClientRect().bottom,
    };
  });
  const noPageScroll = m.docScrollH <= m.innerH && m.pageScrollTop === 0;
  const innerScroll = m.msgScrollH > m.msgClientH && m.msgOverflowY === 'auto';
  const composerVisible = m.composerBottom <= m.innerH;
  const atBottom = m.msgScrollTop + m.msgClientH >= m.msgScrollH - 40;
  console.log(
    `${tag}: docScrollH=${m.docScrollH} innerH=${m.innerH} pageScrollTop=${m.pageScrollTop} | ` +
      `msg ${m.msgScrollH}/${m.msgClientH} ovf=${m.msgOverflowY} top=${m.msgScrollTop} | ` +
      `composerBottom=${Math.round(m.composerBottom)} | ` +
      `noPageScroll=${noPageScroll} innerScroll=${innerScroll} composerVisible=${composerVisible} atBottom=${atBottom}`,
  );
  return { noPageScroll, innerScroll, composerVisible, atBottom };
}

// desktop sizes: open the longest conversation once, then resize
for (const [w, h, name] of [
  [1440, 900, 'chat-1440x900'],
  [1100, 800, 'chat-1100x800'],
  [820, 700, 'chat-820x700'],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^Assistant/ }).click();
  await page.waitForLoadState('networkidle');
  await page.locator('.select-trigger[aria-label="Conversation"]').click();
  await page
    .locator('.select-option', { hasText: 'Send 7 euros to Bruno for coffee' })
    .first()
    .click();
  await page.waitForTimeout(700);
  const r = await measure(name);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  console.log(`captured ${name}.png ${JSON.stringify(r)}`);
}

// empty conversation at 1440x900
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByRole('button', { name: '+ New conversation' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, 'chat-empty-1440x900.png'), fullPage: true });
console.log('captured chat-empty-1440x900.png');

// overview must still scroll the page and show the footer
await page.getByRole('button', { name: /^Overview/ }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
const ov = await page.evaluate(() => ({
  docScrollH: document.documentElement.scrollHeight,
  innerH: window.innerHeight,
  footerVisible: !!document.querySelector('footer')?.getBoundingClientRect().height,
  footerDisplay: getComputedStyle(document.querySelector('footer')).display,
}));
console.log(
  `overview: docScrollH=${ov.docScrollH} innerH=${ov.innerH} scrolls=${ov.docScrollH > ov.innerH} footerDisplay=${ov.footerDisplay}`,
);
await page.screenshot({ path: path.join(out, 'overview-1440x900.png'), fullPage: true });
console.log('captured overview-1440x900.png');

await browser.close();
console.log('done');
