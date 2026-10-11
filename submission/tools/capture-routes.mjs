// Route/deep-link check for the App Router refactor.
// Usage: node tools/capture-routes.mjs  (expects app on :3000)
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'evidencias', 'despues', '30-routes');
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:3000';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'OK ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  console.log(results[results.length - 1]);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: true });

async function switchPerson(name) {
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: name }).first().click();
  await page.waitForLoadState('networkidle');
}
async function nav(name, href) {
  await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
  await page.waitForURL(`**${href}**`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}
const url = () => new URL(page.url()).pathname;

// 1) Lucía: clicks Overview -> Assistant -> conversation
await page.goto(BASE, { waitUntil: 'networkidle' });
check('root redirect', url() === '/overview', url());
await switchPerson('Lucía');
await page.waitForURL('**/overview', { timeout: 10000 });
check('lucia lands /overview', url() === '/overview', url());
await nav('Assistant', '/assistant');
check('assistant url', url() === '/assistant', url());
const convLink = page.locator('.conversation-list a').first();
await convLink.waitFor({ timeout: 10000 });
await convLink.click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(400);
const convUrl = url();
check('conversation deep link', /^\/assistant\/.+/.test(convUrl), convUrl);
const msgCount = await page.locator('.message').count();
check('messages visible', msgCount > 0, `${msgCount} messages`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.message', { timeout: 15000 });
check('reload keeps conversation', url() === convUrl, url());
await shot('reload-assistant');

// 2) Transfers reload
await nav('Transfers', '/transfers');
await page.waitForSelector('input[aria-label="Amount in euros"]', { timeout: 10000 });
check('transfers url', url() === '/transfers', url());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('input[aria-label="Amount in euros"]', { timeout: 10000 });
check('reload keeps transfers', url() === '/transfers', url());
await shot('reload-transfers');

// 3) Documents deep link + reload
await nav('Documents', '/documents');
await page.waitForSelector('.document-list button', { timeout: 10000 });
check('documents url', url() === '/documents', url());
const docTitle = await page.locator('.document-list button strong').first().innerText();
await page.locator('.document-list button').first().click();
try {
  await page.waitForURL('**/documents/**', { timeout: 8000 });
} catch {
  await page.locator('.document-list button').first().click();
  await page.waitForURL('**/documents/**', { timeout: 8000 });
}
await page.waitForLoadState('networkidle');
await page.waitForSelector('.document-reader', { timeout: 10000 });
const docUrl = url();
check('document deep link', /^\/documents\/.+/.test(docUrl), docUrl);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.document-reader', { timeout: 10000 });
const readerTitle = await page.locator('.document-reader').innerText();
check('reload keeps document', url() === docUrl && readerTitle.includes(docTitle), url());
await shot('reload-document');

// 4) Browser history
await page.goBack({ waitUntil: 'networkidle' });
const back1 = url();
await page.goBack({ waitUntil: 'networkidle' });
const back2 = url();
await page.goForward({ waitUntil: 'networkidle' });
const fwd1 = url();
check('history back1', back1 === '/documents', back1);
check('history back2', back2 === '/transfers', back2);
check('history forward', fwd1 === '/documents', fwd1);
console.log(`history: ${docUrl} <-back- ${back1} <-back- ${back2} -forward-> ${fwd1}`);

// 5) Operator routes + role guards
await switchPerson('Marta');
await page.waitForURL('**/cases', { timeout: 10000 });
check('marta lands /cases', url() === '/cases', url());
const caseItem = page.locator('.case-item').first();
await caseItem.waitFor({ timeout: 10000 });
await caseItem.click();
try {
  await page.waitForURL('**/cases/**', { timeout: 8000 });
} catch {
  await caseItem.click();
  await page.waitForURL('**/cases/**', { timeout: 8000 });
}
await page.waitForLoadState('networkidle');
await page.waitForTimeout(300);
const caseUrl = url();
check('case deep link', /^\/cases\/.+/.test(caseUrl), caseUrl);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.case-detail, .selected-case, main .panel', { timeout: 15000 });
check('reload keeps case', url() === caseUrl, url());
await shot('reload-case');
await page.goto(`${BASE}/overview`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
check('marta /overview -> /cases', url() === '/cases', url());
await switchPerson('Lucía');
await page.waitForURL('**/overview', { timeout: 10000 });
check('lucia lands /overview', url() === '/overview', url());
await page.goto(`${BASE}/cases`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
check('lucia /cases -> /overview', url() === '/overview', url());

// 6) Not-found + bad deep link
await page.goto(`${BASE}/no-existe`, { waitUntil: 'networkidle' });
check('/no-existe is 404', await page.locator('.not-found').isVisible());
await shot('not-found');
await page.goto(`${BASE}/assistant/conv-que-no-existe`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
check('bad conv -> /assistant', url() === '/assistant', url());
const errVisible = await page
  .locator('.alert.error')
  .isVisible()
  .catch(() => false);
check('error notice shown', errVisible);
await shot('bad-conversation');

// 7) Active nav + indicator
await nav('Transfers', '/transfers');
await page.waitForTimeout(400);
const active = await page.evaluate(() => ({
  text: document.querySelector('.nav-item.active')?.innerText.trim(),
  indicatorOpacity: getComputedStyle(document.querySelector('.nav-indicator')).opacity,
}));
check('active nav is Transfers', /Transfers/.test(active.text || ''), active.text);
check('indicator visible', active.indicatorOpacity === '1', active.indicatorOpacity);
await shot('nav-active');

await browser.close();
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${fails.length ? `${fails.length} FAILURES` : 'ALL CHECKS OK'} → ${out}`);
process.exit(fails.length ? 1 : 0);
