import {
  BASE,
  APP_DB,
  startRecording,
  finishRecording,
  switchPerson,
  sql,
  scenario,
  smoothWheel,
  beat,
  preClick,
} from './lib.mjs';

const NAME = 'operator-case';
console.log(scenario('normal'));
sql(APP_DB, "UPDATE intents SET status='failed' WHERE id='intent-historic-lucia';");

const rec = await startRecording(NAME);
const { page, mark } = rec;
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  mark('app loaded');
  await beat(page, 700);
  await switchPerson(page, 'Marta');
  await page.waitForURL('**/cases', { timeout: 10000 });
  await page.waitForSelector('.case-item', { timeout: 15000 });
  mark('cases inbox (Marta)');
  await beat(page, 1200);

  await preClick(page);
  await page.locator('.segment', { hasText: 'Resolved' }).click();
  mark('segment Resolved');
  await beat(page, 1500);
  await preClick(page);
  await page.locator('.segment', { hasText: 'Open' }).click();
  mark('segment Open');
  await beat(page, 1000);

  await preClick(page);
  await page.locator('.case-item', { hasText: 'dinner payment' }).first().click();
  await page.waitForURL('**/cases/**', { timeout: 10000 });
  await page.waitForSelector('.timeline', { timeout: 15000 });
  mark('case detail (money check + timeline)');
  await beat(page, 3000);

  await smoothWheel(page, '.timeline', 400);
  mark('timeline scrolled down');
  await beat(page, 600);
  await smoothWheel(page, '.timeline', -400);
  mark('timeline scrolled back');

  await preClick(page);
  await page.getByRole('button', { name: 'Draft a brief' }).click();
  mark('draft a brief clicked');
  await page.waitForSelector('.brief-card', { timeout: 90000 });
  mark('brief card visible');
  await beat(page, 4000);
  await smoothWheel(page, '.brief-card', 300);
  await smoothWheel(page, '.brief-card', -300);

  await preClick(page);
  await page.getByRole('button', { name: 'Apply reconciliation' }).click();
  await page.waitForSelector('text=Reconciled by operator', { timeout: 15000 });
  mark('reconciled by operator');
  await beat(page, 3000);
} finally {
  await finishRecording(rec, NAME);
  sql(APP_DB, "UPDATE intents SET status='failed' WHERE id='intent-historic-lucia';");
  sql(
    APP_DB,
    `DELETE FROM events WHERE kind='intent.reconciled' AND created_at >= datetime('now','-1 hour');`,
  );
  console.log('restored intent-historic-lucia=failed, reconciled events cleaned');
}
