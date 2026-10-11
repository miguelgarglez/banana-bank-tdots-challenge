// Not-found page verification: desktop + mobile screenshots, back-to-home link.
// Usage: node capture-not-found.mjs <out-dir>   (dev server on :3000)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-not-found.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/this-does-not-exist`, { waitUntil: 'networkidle' });
const button = page.locator('a.primary-button[href="/"]');
await button.waitFor();
console.log(`primary-button present: ${await button.isVisible()}`);
await page.screenshot({ path: path.join(out, 'not-found-desktop.png'), fullPage: true });
console.log('captured not-found-desktop.png');

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(out, 'not-found-mobile.png'), fullPage: true });
console.log('captured not-found-mobile.png');

await page.setViewportSize({ width: 1440, height: 900 });
await Promise.all([page.waitForURL(`${BASE}/`), button.click()]);
await page.waitForLoadState('networkidle');
const url = page.url();
const shellVisible = await page.locator('.app-shell').isVisible();
console.log(
  `after click url=${url} ends-with-/=${url.endsWith('/')} app-shell visible=${shellVisible}`,
);
if (!url.endsWith('/') || !shellVisible) {
  console.error('FAIL: back-to-home navigation did not land on /');
  process.exit(1);
}

await browser.close();
console.log('done');
