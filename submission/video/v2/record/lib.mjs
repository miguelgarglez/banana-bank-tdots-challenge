// Shared helpers for screen recordings. Videos land in ../recordings/<name>.mp4
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ROOT = '/Users/miguelgarglez/Developer/hackathon-tdots/challenge-banana-candidate';
export const BASE = 'http://127.0.0.1:3000';
export const APP_DB = `${ROOT}/.data/app.sqlite`;
export const BANK_DB = `${ROOT}/.data/bank.sqlite`;
export const OUT_DIR = '/Users/miguelgarglez/Developer/hackathon-tdots/video-v2/recordings';
export const TMP_DIR = '/Users/miguelgarglez/Developer/hackathon-tdots/video-v2/record/video-tmp';
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

export const sql = (db, q) => execFileSync('sqlite3', [db, q]).toString().trim();
export const scenario = (profile, seed) =>
  execFileSync('npm', ['run', 'scenario', '--', profile, ...(seed ? [String(seed)] : [])], {
    cwd: ROOT,
  })
    .toString()
    .trim();

export async function startRecording(name) {
  const dir = mkdtempSync(path.join(TMP_DIR, `${name}-`));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: 1440, height: 900 } },
  });
  const t0 = Date.now(); // video clock starts when the page is created
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  const mark = (label) => console.log(`MARK ${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);
  return { browser, context, page, dir, mark };
}

export async function finishRecording(rec, name) {
  await rec.context.close();
  await rec.browser.close();
  const webm = readdirSync(rec.dir).find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error(`no webm produced in ${rec.dir}`);
  const input = path.join(rec.dir, webm);
  const output = path.join(OUT_DIR, `${name}.mp4`);
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    input,
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    output,
  ], { stdio: 'pipe' });
  const dur = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    output,
  ])
    .toString()
    .trim();
  console.log(`SAVED ${output} duration=${dur}s`);
  return { output, duration: parseFloat(dur) };
}

export const beat = (page, ms = 900) => page.waitForTimeout(ms);
export const preClick = (page) => page.waitForTimeout(500);

export async function switchPerson(page, name) {
  await page.locator('.select-trigger[aria-label="Switch person"]').click();
  await page.locator('.select-option', { hasText: name }).first().click();
  await page.waitForLoadState('networkidle');
}

export async function nav(page, name) {
  await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
  await page.waitForLoadState('networkidle');
}

export async function newConversation(page) {
  await page.getByRole('button', { name: '+ New conversation' }).click();
  await page.waitForTimeout(400);
}

export async function sendChat(page, text) {
  const ta = page.locator('textarea[aria-label="Message the assistant"]');
  await ta.click();
  await ta.pressSequentially(text, { delay: 90 });
  await page.waitForTimeout(500);
  const before = await page.locator('.message.assistant').count();
  await page.locator('button[aria-label="Send message"]').click();
  return before;
}

export async function waitForReply(page, before, timeout = 90000) {
  await page.waitForFunction(
    (n) => document.querySelectorAll('.message.assistant').length > n,
    before,
    { timeout },
  );
  await page
    .waitForSelector('.thinking', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

export async function lastBubble(page) {
  return (await page.locator('.message.assistant .bubble').last().innerText()).trim();
}

export async function smoothWheel(page, selector, dy = 400, steps = 4) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const step = dy / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(150);
  }
}
