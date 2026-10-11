import {
  BASE,
  startRecording,
  finishRecording,
  switchPerson,
  nav,
  beat,
  preClick,
} from './lib.mjs';

const NAME = 'routes-reload';
const rec = await startRecording(NAME);
const { page, mark } = rec;
const url = () => new URL(page.url()).pathname;
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  mark('app loaded');
  await beat(page, 700);
  await switchPerson(page, 'Lucía');
  await page.waitForURL('**/overview', { timeout: 10000 });
  mark('overview');
  await beat(page, 1000);

  await nav(page, 'Assistant');
  const convLink = page.locator('.conversation-list a').first();
  await convLink.waitFor({ timeout: 10000 });
  await preClick(page);
  await convLink.click();
  await page
    .waitForURL((u) => u.pathname.startsWith('/assistant/'), { timeout: 10000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle');
  const convUrl = url();
  mark(`conversation ${convUrl}`);
  await beat(page, 1000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.message', { timeout: 15000 });
  mark(`reloaded, url kept=${url() === convUrl}`);
  await beat(page, 1000);

  await nav(page, 'Transfers');
  await page.waitForSelector('input[aria-label="Amount in euros"]', { timeout: 10000 });
  mark('transfers');
  await beat(page, 1000);

  await nav(page, 'Documents');
  await page.waitForSelector('.document-list button', { timeout: 10000 });
  mark('documents');
  await beat(page, 800);
  await preClick(page);
  await page.locator('.document-list button').first().click();
  try {
    await page.waitForURL('**/documents/**', { timeout: 8000 });
  } catch {
    await page.locator('.document-list button').first().click();
    await page.waitForURL('**/documents/**', { timeout: 8000 });
  }
  await page.waitForSelector('.document-reader', { timeout: 10000 });
  const docUrl = url();
  mark(`document ${docUrl}`);
  await beat(page, 1000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.document-reader', { timeout: 10000 });
  mark(`reloaded, url kept=${url() === docUrl}`);
  await beat(page, 1000);

  await page.goBack({ waitUntil: 'networkidle' });
  mark(`back -> ${url()}`);
  await beat(page, 1000);
  await page.goBack({ waitUntil: 'networkidle' });
  mark(`back -> ${url()}`);
  await beat(page, 1000);
  await page.goForward({ waitUntil: 'networkidle' });
  mark(`forward -> ${url()}`);
  await beat(page, 1000);

  await page.goto(`${BASE}/no-existe`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.not-found', { timeout: 10000 });
  mark('404 page');
  await beat(page, 1200);
  await preClick(page);
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page
    .waitForURL((u) => u.pathname !== '/no-existe', { timeout: 15000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle');
  mark(`back home -> ${url()}`);
  await beat(page, 1500);
} finally {
  await finishRecording(rec, NAME);
}
