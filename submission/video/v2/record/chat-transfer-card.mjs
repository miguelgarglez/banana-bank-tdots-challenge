import {
  BASE,
  startRecording,
  finishRecording,
  switchPerson,
  nav,
  newConversation,
  sendChat,
  waitForReply,
  lastBubble,
  beat,
  preClick,
} from './lib.mjs';

const NAME = 'chat-transfer-card';
const rec = await startRecording(NAME);
const { page, mark } = rec;
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  mark('app loaded');
  await beat(page, 700);
  await switchPerson(page, 'Lucía');
  mark('person Lucía');
  await beat(page, 700);
  await nav(page, 'Assistant');
  mark('assistant tab');
  await beat(page, 900);

  let hasCard = false;
  for (const prompt of [
    'quiero mandarle 20 euros a Bruno',
    'quiero enviar dinero a Carla',
  ]) {
    await newConversation(page);
    mark('new conversation');
    await beat(page, 600);
    const before = await sendChat(page, prompt);
    mark(`sent "${prompt}"`);
    const cardAppears = page
      .waitForSelector('.chat-transfer .transfer-card.phase-draft', { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    await waitForReply(page, before, 60000).catch(() => {});
    hasCard = await cardAppears;
    if (!hasCard) {
      // card may render slightly after the bubble; give it a moment
      await page
        .waitForSelector('.chat-transfer .transfer-card.phase-draft', { timeout: 15000 })
        .then(() => (hasCard = true))
        .catch(() => {});
    }
    mark(`reply received, draft card=${hasCard}`);
    if (hasCard) break;
  }

  if (hasCard) {
    const amountInput = page.locator('.chat-transfer input[aria-label="Amount in euros"]');
    if (!(await amountInput.inputValue())) {
      await amountInput.click();
      await amountInput.pressSequentially('20', { delay: 160 });
      mark('amount filled');
    }
    const descInput = page.locator('.chat-transfer input[aria-label="Description"]');
    if (!(await descInput.inputValue())) {
      await descInput.click();
      await descInput.pressSequentially('Cena del viernes', { delay: 90 });
      mark('description filled');
    }
    await beat(page, 800);
    await page
      .waitForSelector('.chat-transfer button.transfer-submit:not([disabled])', {
        timeout: 10000,
      })
      .catch(() => {});
    await preClick(page);
    await page.locator('.chat-transfer button.transfer-submit').click();
    await page.waitForSelector('.chat-transfer .transfer-card.phase-review');
    mark('review card');
    await beat(page, 3000);
    await preClick(page);
    await page.locator('.chat-transfer .primary-button', { hasText: 'Confirm' }).click();
    await page.waitForSelector('.chat-transfer .transfer-card.phase-done', { timeout: 60000 });
    mark('done card (SENT)');
    await beat(page, 2500);
  } else {
    console.log('NO CARD: last reply:', JSON.stringify(await lastBubble(page)));
    await beat(page, 2000);
  }
} finally {
  await finishRecording(rec, NAME);
}
