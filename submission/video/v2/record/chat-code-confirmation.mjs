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

const NAME = 'chat-code-confirmation';
const rec = await startRecording(NAME);
const { page, mark } = rec;
const replies = [];
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  mark('app loaded');
  await beat(page, 700);
  await switchPerson(page, 'Lucía');
  await beat(page, 700);
  await nav(page, 'Assistant');
  await beat(page, 800);
  await newConversation(page);
  mark('new conversation');
  await beat(page, 600);

  let before = await sendChat(
    page,
    'Send 5 euros from my Aurora account to Bruno for coffee',
  );
  mark('sent request');
  await waitForReply(page, before, 90000);
  replies.push(await lastBubble(page));
  mark(`reply 1: ${replies[0].slice(0, 80)}`);
  await beat(page, 1500);

  before = await sendChat(page, 'yes');
  mark('sent "yes"');
  await waitForReply(page, before, 90000);
  replies.push(await lastBubble(page));
  mark(`reply 2 (reject): ${replies[1].slice(0, 80)}`);
  await beat(page, 1200);

  // read the confirmation code: review card, composer placeholder, or bubble text
  let code = await page
    .locator('.chat-transfer .confirmation-code')
    .first()
    .innerText()
    .catch(() => null);
  if (!code) code = await page.locator('.confirmation-code').first().innerText().catch(() => null);
  if (!code) {
    const ph = await page
      .locator('textarea[aria-label="Message the assistant"]')
      .getAttribute('placeholder')
      .catch(() => '');
    code = ph?.match(/confirm\s+([A-Za-z0-9]+)/i)?.[1] ?? null;
  }
  if (!code) {
    const all = await page.locator('.message.assistant .bubble').allInnerTexts();
    code = all.join(' ').match(/confirm\s+([A-Za-z0-9]{4,})/i)?.[1] ?? null;
  }
  console.log('CONFIRM CODE:', code);
  if (!code) throw new Error('could not find confirmation code in DOM');
  mark(`code read: ${code}`);
  await beat(page, 800);

  before = await sendChat(page, `confirm ${code}`);
  mark(`sent "confirm ${code}"`);
  await waitForReply(page, before, 90000);
  replies.push(await lastBubble(page));
  mark(`reply 3 (done): ${replies[2].slice(0, 80)}`);
  await page
    .waitForSelector('.transfer-card.phase-done', { timeout: 15000 })
    .then(() => mark('card phase-done'))
    .catch(() => {});
  await beat(page, 2500);
} finally {
  console.log('ASSISTANT REPLIES:', JSON.stringify(replies, null, 2));
  await finishRecording(rec, NAME);
}
