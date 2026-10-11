import {
  BASE,
  startRecording,
  finishRecording,
  switchPerson,
  beat,
} from './lib.mjs';

const NAME = 'overview-polish';
const rec = await startRecording(NAME);
const { page, mark } = rec;
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  mark('app loaded');
  await beat(page, 700);
  await switchPerson(page, 'Lucía');
  await page.waitForURL('**/overview', { timeout: 10000 });
  mark('lucía overview');
  await beat(page, 2000);

  await page.locator('.brand-symbol').hover();
  mark('logo hover (wiggle)');
  await beat(page, 1200);

  await switchPerson(page, 'Bruno');
  mark('switched to Bruno (banana loader)');
  await page.waitForURL('**/overview', { timeout: 10000 }).catch(() => {});
  await beat(page, 2000);
  mark('bruno overview');
} finally {
  await finishRecording(rec, NAME);
}
