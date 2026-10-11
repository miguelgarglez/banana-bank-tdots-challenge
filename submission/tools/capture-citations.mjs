// Citation chips verification. Usage: node capture-citations.mjs <out-dir>
// Inserts a deterministic conversation for Lucía with a resolvable citation
// ([faq-human v2]) and an unresolvable one ([ghost-doc v1]), then checks:
//   - chip renders with the doc title, raw token never visible, ghost omitted
//   - clicking the chip opens Documents with that document in the reader
//   - a normal conversation shows no stray citation text/chips

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate';
const BASE = 'http://127.0.0.1:3000';
const out = process.argv[2];
if (!out) {
  console.error('usage: capture-citations.mjs <out-dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const db = `${ROOT}/.data/app.sqlite`;
const sql = (q) => execSync(`sqlite3 "${db}" "${q}"`).toString();
sql(`DELETE FROM messages WHERE conversation_id='conv-citation-check';`);
sql(`DELETE FROM conversations WHERE id='conv-citation-check';`);
sql(
  `INSERT INTO conversations VALUES('conv-citation-check','lucia','Citation check',datetime('now'));`,
);
sql(
  `INSERT INTO messages VALUES('msg-cit-1','conv-citation-check','user','Can I talk to a person?',datetime('now','-1 seconds'),NULL);`,
);
sql(
  `INSERT INTO messages VALUES('msg-cit-2','conv-citation-check','assistant','Yes, you can ask for human support and we will open a case. [faq-human v2] There is also more context in [ghost-doc v1].',datetime('now'),NULL);`,
);
console.log('fixture conversation conv-citation-check inserted');

const cleanup = () => {
  sql(`DELETE FROM messages WHERE conversation_id='conv-citation-check';`);
  sql(`DELETE FROM conversations WHERE id='conv-citation-check';`);
  console.log('fixture conv-citation-check removed');
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  async function clipShot(sel, name, margin = 16, last = false) {
    const loc = last ? page.locator(sel).last() : page.locator(sel).first();
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

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: 'Lucía' }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^Assistant/ }).click();
  await page.waitForLoadState('networkidle');
  await page.locator('.select-trigger[aria-label="Conversation"]').click();
  await page.locator('.select-option', { hasText: 'Citation check' }).first().click();
  await page.waitForTimeout(700);

  const check = await page.evaluate(() => {
    const chip = document.querySelector('button.citation');
    const msgText = document.querySelector('.messages').innerText;
    return {
      chipText: chip?.innerText.trim(),
      hasRawToken: msgText.includes('[faq-human'),
      hasGhost: msgText.includes('ghost-doc'),
    };
  });
  console.log(
    `chip=${JSON.stringify(check.chipText)} rawToken=${check.hasRawToken} ghostVisible=${check.hasGhost}`,
  );
  await clipShot('.message.assistant .bubble', 'citation-chip-bubble', 16, true);

  // click the chip -> Documents tab with the document open
  await page.locator('button.citation').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const docCheck = await page.evaluate(() => ({
    activeNav: document.querySelector('.nav-item.active')?.innerText.trim(),
    readerTitle: document.querySelector('.document-reader h2')?.innerText.trim(),
  }));
  console.log(
    `activeNav=${JSON.stringify(docCheck.activeNav)} readerTitle=${JSON.stringify(docCheck.readerTitle)}`,
  );
  await page.screenshot({ path: path.join(out, 'citation-doc-open.png'), fullPage: true });
  console.log('captured citation-doc-open.png');

  // normal conversation: no citation text or chips
  await page.getByRole('button', { name: /^Assistant/ }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const coffee = page.locator('.select-option', { hasText: 'Dinner payment' }).first();
  for (let i = 0; i < 3 && !(await coffee.isVisible().catch(() => false)); i++) {
    await page.locator('.select-trigger[aria-label="Conversation"]').click();
    await page.waitForTimeout(400);
  }
  await coffee.click();
  await page.waitForTimeout(700);
  const clean = await page.evaluate(() => ({
    chips: document.querySelectorAll('button.citation').length,
    orphan: document.querySelector('.messages').innerText.includes('aurora-conditions-2026'),
  }));
  console.log(`coffee conv: chips=${clean.chips} orphanTokenVisible=${clean.orphan}`);
  await clipShot('.message.assistant .bubble', 'no-citation-bubble', 16, true);

  await browser.close();
} finally {
  cleanup();
}
console.log('done');
