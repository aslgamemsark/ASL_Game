// ASL-G3 — camera-permission moment probe, v2 (ad-hoc, not part of the canonical suite).
// Three scenarios against the production build:
//   A. LESSON page (Say Hello world lesson): does CameraOnboarding privacy primer appear before
//      any native permission ask? Does "Not now" back out cleanly?
//   B. GRANTED: Allow -> live view timing.
//   C. PRACTICE expressive path with getUserMedia denied (NotAllowedError injected pre-module):
//      honest denied card + Try again recovery once access returns.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const b = await chromium.launch();

async function onboard(page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
  await nav.waitFor({ state: 'visible', timeout: 15000 });
  return nav;
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
}

// ---------- Scenario A: LessonPage privacy primer (Journey tab -> first world lesson) ----------
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  });
  const page = await ctx.newPage();
  const nav = await onboard(page);
  // Journey tab -> first lesson node ("Say Hello" lesson lives in the first world).
  await nav.getByRole('button', { name: /Journey/ }).first().click();
  await page.waitForTimeout(700);
  // Tap the current lesson node (aria-label added in ASL-A8).
  const node = page.locator('[aria-label^="Lesson:"]').first();
  if (!(await node.isVisible().catch(() => false))) {
    console.log('A-SKIP: no lesson node visible on Journey map for guest');
  } else {
    await node.click();
    await page.waitForTimeout(800);
    const overlay = page.getByRole('dialog', { name: /camera access/i });
    let overlaySeen = false;
    try { await overlay.waitFor({ state: 'visible', timeout: 10000 }); overlaySeen = true; } catch {}
    rec('A(lesson): privacy primer dialog appears before camera start', overlaySeen,
      overlaySeen ? `"${(await overlay.innerText()).replace(/\s+/g, ' ').slice(0, 55)}"` : 'no dialog');

    if (overlaySeen) {
      const copy = await overlay.innerText();
      rec('A(lesson): privacy reassurance present',
        /never leaves your device|never uploaded|runs locally/i.test(copy), '');
      const notNow = overlay.getByRole('button', { name: /not now/i });
      rec('A(lesson): "Not now" polite decline exists',
        await notNow.isVisible().catch(() => false), '');
      await notNow.click();
      await page.waitForTimeout(800);
      const after = await bodyText(page);
      rec('A(lesson): "Not now" backs out to a usable screen',
        !/Camera Access Needed/.test(after) && after.length > 50,
        `"${after.slice(0, 45)}"`);
    }
  }
  await ctx.close();
}

// ---------- Scenario B: granted — Allow -> live view ----------
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  });
  const page = await ctx.newPage();
  const nav = await onboard(page);
  await nav.getByRole('button', { name: /Alphabets/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Practice Letters/i }).first().click();
  const t0 = Date.now();
  const overlay = page.getByRole('dialog', { name: /camera access/i });
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.getByRole('button', { name: /allow camera/i }).click();
  }
  try {
    await page.getByText('Sign this', { exact: true }).first()
      .waitFor({ state: 'visible', timeout: 20000 });
    rec(`B(granted): Allow -> live signing view (${((Date.now() - t0) / 1000).toFixed(1)}s)`, true, '');
  } catch {
    rec('B(granted): Allow -> live signing view', false, 'timeout');
  }
  await ctx.close();
}

// ---------- Scenario C: PracticePage expressive with gUM denied ----------
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
  });
  const nav = await onboard(page);
  await nav.getByRole('button', { name: /Alphabets/ }).first().click();
  await page.waitForTimeout(500);
  // Practice Letters = autoStart EXPRESSIVE (camera required immediately) — the reliable path
  // to the denied card. (Test from Memory starts with receptive questions that need no camera.)
  await page.getByRole('button', { name: /Practice Letters/i }).first().click();
  // Sign It mode -> startExpressive -> startCam -> NotAllowedError.
  const signItCard = page.locator('button.w-full.rounded-2xl.p-5').filter({ hasText: /Sign It/i }).first();
  if (!(await signItCard.isVisible().catch(() => false))) {
    // mixed quiz may have started directly; skip receptive questions until an expressive one.
    for (let i = 0; i < 8; i++) {
      const choices = page.locator('button.p-4.rounded-2xl.font-bold').filter({ visible: true });
      if ((await choices.count()) >= 4) {
        await choices.first().click();
        await page.waitForTimeout(1600);
      } else break;
    }
  }
  // Look for the denied card anywhere. Poll: the card appears after the expressive prompt mounts
  // and startCam rejects; the queue may need a couple of skips to reach an expressive item.
  let denied = null;
  for (let t = 0; t < 15000 && !denied; t += 1000) {
    denied = await page
      .getByText(/Camera access denied/i)
      .first()
      .isVisible()
      .then(async v => (v ? await page.getByText(/Camera access denied/i).first().innerText() : null))
      .catch(() => null);
    if (!denied) {
      const skip = page.getByRole('button', { name: /skip/i }).first();
      if (await skip.isVisible().catch(() => false)) {
        await skip.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(900);
    }
  }
  rec('C(practice): denial produces honest "Camera access denied" card', !!denied,
    `card="${(denied || '').slice(0, 36)}"`);
  const guidance = await bodyText(page);
  rec('C(practice): copy points to browser settings + offers Try again',
    /browser settings|Allow camera access/i.test(guidance) && /Try again/i.test(guidance), '');

  // Recovery: swap in a working stub (canvas stream), press Try again.
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas');
      c.width = 640; c.height = 480;
      return c.captureStream(15);
    };
  });
  const retryBtn = page.getByRole('button', { name: /try again/i }).first();
  if (await retryBtn.isVisible().catch(() => false)) {
    await retryBtn.click();
    await page.waitForTimeout(2200);
    const recovered = !(await bodyText(page)).includes('Camera access denied');
    rec('C(practice): Try again recovers once access is available', recovered,
      `recovered=${recovered}`);
  } else {
    rec('C(practice): Try again button present after denial', false, 'no button');
  }
  await ctx.close();
}

await b.close();
const failed = results.filter(r => !r.ok);
console.log(`\nG3 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
