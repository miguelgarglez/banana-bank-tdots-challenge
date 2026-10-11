// Shared transfer-tab flow used by transfer-tab.mjs and transfer-lost-response.mjs
import {
  BASE,
  startRecording,
  finishRecording,
  switchPerson,
  nav,
  beat,
  preClick,
} from './lib.mjs';

export async function runTransfer({ name, recipient, amount, description }) {
  const rec = await startRecording(name);
  const { page, mark } = rec;
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    mark('app loaded');
    await beat(page, 700);
    await switchPerson(page, 'Lucía');
    mark('person Lucía');
    await beat(page, 800);
    await nav(page, 'Transfers');
    await page.waitForSelector('.transfer-card.phase-draft');
    mark('transfers draft card');
    await beat(page, 1000);

    await preClick(page);
    await page.locator('.recipient-chip', { hasText: recipient }).first().click();
    mark(`recipient ${recipient}`);
    await beat(page, 700);
    const pills = await page.locator('.account-pill').count();
    if (pills) {
      await preClick(page);
      await page.locator('.account-pill').first().click();
      mark('account pill selected');
      await beat(page, 700);
    }

    const amountInput = page.locator('input[aria-label="Amount in euros"]');
    await amountInput.click();
    await amountInput.pressSequentially(amount, { delay: 160 });
    mark(`amount ${amount} typed`);
    await beat(page, 900);

    const descInput = page.locator('input[aria-label="Description"]');
    await descInput.click();
    await descInput.pressSequentially(description, { delay: 90 });
    mark('description typed');
    await beat(page, 800);

    await page.waitForSelector('button.transfer-submit:not([disabled])');
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('button.transfer-submit')).opacity === '1',
    );
    await preClick(page);
    await page.getByRole('button', { name: 'Review transfer' }).click();
    await page.waitForSelector('.transfer-card.phase-review');
    mark('review card (code + countdown)');
    await beat(page, 3000);

    await preClick(page);
    await page.getByRole('button', { name: 'Confirm transfer' }).click();
    await page.waitForSelector('.transfer-card.phase-done', { timeout: 60000 });
    const doneText = await page.locator('.transfer-card.phase-done').innerText();
    mark(`done card: ${doneText.includes('SENT') ? 'SENT' : 'not-sent'}`);
    console.log('DONE TEXT:', JSON.stringify(doneText.replace(/\n/g, ' | ')));
    await beat(page, 2500);
  } finally {
    const res = await finishRecording(rec, name);
    return res;
  }
}
