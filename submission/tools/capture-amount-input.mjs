// Amount hero input check: keystroke filter + torph digit animation.
// Usage: node tools/capture-amount-input.mjs  (expects app on :3000)
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'evidencias', 'despues', '31-amount-input');
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'OK ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  console.log(results[results.length - 1]);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// width of the morph's rendered digits: union of leaf rects containing text
const morphInfo = () =>
  page.evaluate(() => {
    const morph = document.querySelector('.amount-morph');
    if (!morph) return null;
    let left = Infinity,
      right = -Infinity;
    const text = [];
    const walk = (el) => {
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
          const range = document.createRange();
          range.selectNode(node);
          const r = range.getBoundingClientRect();
          if (r.width > 0) {
            left = Math.min(left, r.left);
            right = Math.max(right, r.right);
          }
          text.push(node.textContent);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const cs = getComputedStyle(node);
          if (
            !node.hasAttribute('torph-sr') &&
            cs.display !== 'none' &&
            node.getBoundingClientRect().width > 0
          )
            walk(node);
        }
      }
    };
    walk(morph);
    const cs = getComputedStyle(morph);
    const canvas = document.createElement('canvas').getContext('2d');
    canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    try {
      canvas.letterSpacing = cs.letterSpacing;
    } catch {}
    return {
      text: text.join(''),
      digitsWidth: right > left ? right - left : 0,
      canvasWidth: canvas.measureText(text.join('')).width,
      color: cs.color,
      empty: morph.hasAttribute('data-empty'),
    };
  });

await page.goto('http://127.0.0.1:3000/transfers', { waitUntil: 'networkidle' });
const input = page.locator('input[aria-label="Amount in euros"]');
await input.waitFor({ timeout: 15000 });
await page.waitForTimeout(600);

// (a) keystroke filter: "12a.5b" -> "12.5"
await input.click();
await page.keyboard.type('12a.5b', { delay: 80 });
await page.waitForTimeout(900); // let torph settle
const typed = await input.inputValue();
const m1 = await morphInfo();
check('typing filter', typed === '12.5', `input="${typed}"`);
check('morph shows digits', m1.text === '12.5', `morph="${m1.text}"`);
const box = await page.locator('.amount-hero-input').boundingBox();
await page.screenshot({
  path: path.join(out, 'amount-typing.png'),
  clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
});

// caret/morph alignment: with "1234.5" the morph digits width must match
// canvas-measured width of the same string in the same font (< 2px)
await input.fill('');
await input.pressSequentially('1234.5', { delay: 40 });
await page.waitForTimeout(900);
const m2 = await morphInfo();
const diff = Math.abs(m2.digitsWidth - m2.canvasWidth);
check(
  'caret/morph alignment',
  diff < 2,
  `digits=${m2.digitsWidth.toFixed(1)}px canvas=${m2.canvasWidth.toFixed(1)}px diff=${diff.toFixed(2)}px`,
);

// (b) comma paste via fill -> normalized
await input.fill('99,99');
await page.waitForTimeout(700);
const filled = await input.inputValue();
check('fill normalizes comma', filled === '99.99', `input="${filled}"`);

// empty state shows ghost 0.00
await input.fill('');
await page.waitForTimeout(900);
const m3 = await morphInfo();
check(
  'ghost 0.00 when empty',
  m3.text === '0.00' && m3.empty,
  `text="${m3.text}" empty=${m3.empty} color=${m3.color}`,
);

await browser.close();
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${fails.length ? `${fails.length} FAILURES` : 'ALL CHECKS OK'} → ${out}`);
process.exit(fails.length ? 1 : 0);
