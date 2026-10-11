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
} from './lib.mjs';

const NAME = 'agent-scope';
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

  let before = await sendChat(page, 'Can you write me a Python script to sort a list?');
  mark('sent off-scope request');
  await waitForReply(page, before, 90000);
  replies.push(await lastBubble(page));
  mark(`reply 1 (refusal): ${replies[0].slice(0, 80)}`);
  await beat(page, 1500);

  before = await sendChat(page, 'What is the monthly fee of the Aurora account?');
  mark('sent in-scope question');
  await waitForReply(page, before, 90000);
  replies.push(await lastBubble(page));
  const chips = await page.locator('button.citation').count();
  mark(`reply 2 (citations=${chips}): ${replies[1].slice(0, 80)}`);
  await beat(page, 2500);
} finally {
  console.log('ASSISTANT REPLIES:', JSON.stringify(replies, null, 2));
  await finishRecording(rec, NAME);
}
