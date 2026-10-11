import {
  BASE,
  APP_DB,
  startRecording,
  finishRecording,
  switchPerson,
  nav,
  sql,
  beat,
  preClick,
} from './lib.mjs';

const NAME = 'citations';
const insertFixture = () => {
  sql(APP_DB, `DELETE FROM messages WHERE conversation_id='conv-citation-check';`);
  sql(APP_DB, `DELETE FROM conversations WHERE id='conv-citation-check';`);
  sql(
    APP_DB,
    `INSERT INTO conversations VALUES('conv-citation-check','lucia','Citation check',datetime('now'));`,
  );
  sql(
    APP_DB,
    `INSERT INTO messages VALUES('msg-cit-1','conv-citation-check','user','Can I talk to a person?',datetime('now','-1 seconds'),NULL);`,
  );
  sql(
    APP_DB,
    `INSERT INTO messages VALUES('msg-cit-2','conv-citation-check','assistant','Yes, you can ask for human support and we will open a case. [faq-human v2] There is also more context in [ghost-doc v1].',datetime('now'),NULL);`,
  );
};
const cleanup = () => {
  sql(APP_DB, `DELETE FROM messages WHERE conversation_id='conv-citation-check';`);
  sql(APP_DB, `DELETE FROM conversations WHERE id='conv-citation-check';`);
  console.log('fixture conv-citation-check removed');
};

insertFixture();
const rec = await startRecording(NAME);
const { page, mark } = rec;
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  mark('app loaded');
  await beat(page, 700);
  await switchPerson(page, 'Lucía');
  await beat(page, 700);
  await nav(page, 'Assistant');
  await page.waitForLoadState('networkidle');
  mark('assistant tab');
  await beat(page, 800);

  await page.locator('.select-trigger[aria-label="Conversation"]').click();
  await page.locator('.select-option', { hasText: 'Citation check' }).first().click();
  await page.waitForSelector('button.citation', { timeout: 10000 });
  mark('citation conversation open, chip visible');
  await beat(page, 2000);

  await preClick(page);
  await page.locator('button.citation').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.document-reader', { timeout: 10000 });
  const title = await page
    .locator('.document-reader h2')
    .innerText()
    .catch(() => '?');
  mark(`document reader open: ${title.trim()}`);
  await beat(page, 3000);
} finally {
  await finishRecording(rec, NAME);
  cleanup();
}
