// BananaMark loader verification: standalone page with the real motion.css,
// paused-animation frames of banana-spin, stem-attachment zoom, bbox/centroid checks.
// Usage: node capture-banana-loader.mjs <out-dir>

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const motionCss = readFileSync(path.join(root, 'app/styles/motion.css'), 'utf8');

const out = process.argv[2];
if (!out) {
  console.error('usage: capture-banana-loader.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const svgMarkup = (size) => `
  <svg width="${size}" height="${size}" viewBox="0 0 32 32">
    <g class="banana-shape">
      <path d="M25 4c1 13-7 22-20 20 6 9 25 1 23-16Z" fill="currentColor" />
      <path d="M25.4 4.6c1.6-0.5 2.8-1.4 3.4-3.1" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" />
    </g>
  </svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 400, height: 400 },
  deviceScaleFactor: 4,
});

await page.setContent(`<!doctype html>
<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#2e4a3c">
  <style>${motionCss}</style>
  <span class="banana-mark-icon banana-loading">${svgMarkup(44)}</span>
</body></html>`);
await page.waitForTimeout(100);

// 1) real bounding box of the rigid group (viewBox user units)
const bb = await page.evaluate(() => {
  const b = document.querySelector('.banana-shape').getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
});
console.log(
  `banana-shape bbox: x=${bb.x.toFixed(2)} y=${bb.y.toFixed(2)} w=${bb.w.toFixed(2)} h=${bb.h.toFixed(2)} cx=${bb.cx.toFixed(1)} cy=${bb.cy.toFixed(1)}`,
);

// 2) pause spin, step through key timestamps, shot each frame + centroid drift
const times = [0, 300, 600, 870, 950, 1050, 1400];
await page.evaluate(() => {
  for (const a of document.getAnimations()) a.pause();
});
const centroids = {};
for (const t of times) {
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) a.currentTime = t;
  }, t);
  await page.waitForTimeout(30);
  const c = await page.evaluate(() => {
    // centroid of ~200 outline samples of the body path, back in viewBox units
    const pathEl = document.querySelector('.banana-shape path');
    const svg = pathEl.ownerSVGElement;
    const scale = svg.getBoundingClientRect().width / 32;
    const ctm = pathEl.getCTM();
    const len = pathEl.getTotalLength();
    let sx = 0,
      sy = 0,
      n = 0;
    for (let i = 0; i < 200; i++) {
      const p = pathEl.getPointAtLength((len * i) / 200).matrixTransform(ctm);
      sx += p.x;
      sy += p.y;
      n++;
    }
    const tf = getComputedStyle(document.querySelector('.banana-shape')).transform;
    return { x: sx / n / scale, y: sy / n / scale, tf };
  });
  console.log(`  transform at ${t}ms: ${c.tf}`);
  centroids[t] = c;
  await page.screenshot({ path: path.join(out, `spin-${String(t).padStart(4, '0')}ms.png`) });
  console.log(`captured spin-${t}ms.png  body-centroid=(${c.x.toFixed(2)}, ${c.y.toFixed(2)})`);
}
const base = centroids[0];
for (const t of [300, 600, 870, 950, 1050, 1400]) {
  const d = Math.hypot(centroids[t].x - base.x, centroids[t].y - base.y);
  console.log(`centroid drift ${t}ms vs 0ms: ${d.toFixed(2)} viewBox units (limit ~1)`);
}

// 3) idle mark at 8x zoom to prove stem touches the body
await page.setContent(`<!doctype html>
<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#2e4a3c">
  <span class="banana-mark-icon">${svgMarkup(352)}</span>
</body></html>`);
await page.waitForTimeout(50);
const loc = page.locator('svg').first();
const box = await loc.boundingBox();
await page.screenshot({
  path: path.join(out, 'idle-stem-8x.png'),
  clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
});
console.log('captured idle-stem-8x.png');

await browser.close();
console.log('done');
