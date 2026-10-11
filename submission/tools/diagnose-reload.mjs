// Reload diagnosis. Usage: node diagnose-reload.mjs <out-dir>
// Reloads the app N times in several states, captures console/page errors and
// the Next.js dev overlay; screenshots any failure.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2] || '/tmp/reload-diag';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || /hydrat|mismatch|unhandled/i.test(m.text()))
    errors.push(`[console.${m.type()}] ${m.text().slice(0, 500)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e).slice(0, 800)}`));

async function checkOverlay(tag) {
  const overlay = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal?.shadowRoot) return null;
    const dialog =
      portal.shadowRoot.querySelector(
        '[data-nextjs-dialog-overlay], [data-nextjs-dialog], nextjs-dialog',
      ) ||
      [...portal.shadowRoot.querySelectorAll('*')].find(
        (el) =>
          el.tagName !== 'STYLE' &&
          el.children.length === 0 &&
          /Unhandled Runtime Error|Hydration failed|did not match|There was an error/i.test(
            el.textContent || '',
          ),
      );
    if (!dialog) {
      const badBadge = portal.shadowRoot.querySelector('[data-next-badge][data-error="true"]');
      return badBadge ? 'nextjs dev badge reports error state' : null;
    }
    return dialog.textContent?.slice(0, 800) || 'dialog present';
  });
  const appError = await page.evaluate(
    () => document.querySelector('.not-found, .error-state')?.textContent?.slice(0, 300) ?? null,
  );
  return { tag, overlay, appError };
}

let failures = 0;
async function reloadCycle(tag, times) {
  for (let i = 0; i < times; i++) {
    const before = errors.length;
    try {
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      errors.push(`[reload ${tag}#${i}] ${String(e).slice(0, 300)}`);
    }
    const st = await checkOverlay(`${tag}#${i}`);
    if (st.overlay || st.appError || errors.length > before) {
      failures++;
      console.log(`FAIL ${tag}#${i}:`, JSON.stringify(st));
      await page.screenshot({ path: path.join(out, `fail-${tag}-${i}.png`), fullPage: true });
    } else {
      console.log(`ok ${tag}#${i}`);
    }
  }
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await reloadCycle('root', 10);

// Assistant with a conversation open, then reload
await page.locator('.select-trigger[aria-label="Switch person"]').click();
await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: /^Assistant/ }).click();
await page.getByRole('combobox', { name: 'Conversation' }).click();
await page.locator('.select-option').nth(1).click();
await page.waitForSelector('.message', { timeout: 10000 });
await reloadCycle('assistant', 5);

// Transfers tab, reload
await page.getByRole('button', { name: /^Transfers/ }).click();
await page.waitForSelector('.transfer-card', { timeout: 10000 });
await reloadCycle('transfers', 5);

await browser.close();
console.log(`\n=== ${failures} failures ===`);
console.log(errors.slice(0, 30).join('\n---\n') || '(no console/page errors captured)');
