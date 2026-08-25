// ASL-G2 — time-to-first-success execution probe, v2 (ad-hoc, not part of the canonical suite).
// Measures the activation funnel tap by tap with wall-clock timings:
//   cold load -> welcome -> onboarding (3 taps) -> Home -> Practice Letters ->
//   hand-check gate (one-time) -> live signing view -> FIRST CORRECT SIGN recognized.
// The fake camera loops a non-sign video, so a real verifier pass is not guaranteed; when no pass
// occurs within 45 s the probe records the Skip-path floor (the honest stuck-learner escape) and
// reports both numbers. 90 s threshold per master mission.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const T0 = Date.now();
const marks = [];
function mark(label) {
  const t = Number(((Date.now() - T0) / 1000).toFixed(1));
  marks.push({ label, t });
  console.log(`  [${String(t).padStart(5)}s] ${label}`);
  return t;
}

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});
const page = await ctx.newPage();

mark('cold navigation start');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /get started/i }).waitFor({ state: 'visible', timeout: 30000 });
mark('welcome interactive (Get started visible)');
await page.getByRole('button', { name: /get started/i }).click();
mark('tap: Get started');
await page.getByRole('button', { name: /continue as guest/i }).click();
mark('tap: Continue as guest');
await page.getByRole('button', { name: /just starting/i }).click();
mark('tap: Just Starting');
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.waitFor({ state: 'visible', timeout: 15000 });
mark('Home visible');

await nav.getByRole('button', { name: /Alphabets/ }).first().click();
mark('tap: Alphabets tab');
await page.getByRole('button', { name: /Practice Letters/i }).first().click();
mark('tap: Practice Letters');

// One-time gates: the dominant-hand check ("Skip for now") is the only blocker between the
// Practice Letters card and the live prompt on a fresh account (camera-permission overlay is
// auto-granted by the fake-UI flag). Live-view marker: PracticePage's "Sign this" label
// (PracticePage.tsx:523 — rendered uppercase by CSS, DOM text is "Sign this").
let liveReached = false;
for (let i = 0; i < 8 && !liveReached; i++) {
  if (await page.getByText('Sign this', { exact: true }).first().isVisible().catch(() => false)) {
    liveReached = true;
    break;
  }
  const skipHand = page.getByRole('button', { name: /skip for now/i }).first();
  if (await skipHand.isVisible().catch(() => false)) {
    await skipHand.click({ force: true }).catch(() => {});
    mark('tap: Skip for now (hand check)');
    await page.waitForTimeout(900);
    continue;
  }
  await page.waitForTimeout(600);
}
if (!liveReached) {
  try {
    await page.getByText('Sign this', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    liveReached = true;
  } catch {}
}
if (!liveReached) {
  console.log('\nFATAL: live signing view never reached');
  process.exit(1);
}
mark('live signing view reached (prompt visible)');

// Wait up to 45 s for a real verifier pass; otherwise record the skip escape.
let passed = false;
for (let i = 0; i < 45; i++) {
  const ok = await page.evaluate(() => {
    const el = document.querySelector('p[role="status"]');
    return el ? /XP/.test(el.textContent || '') : false;
  }) || (await page.getByText(/nice work/i).first().isVisible().catch(() => false));
  if (ok) { passed = true; break; }
  await page.waitForTimeout(1000);
}
if (passed) {
  mark('FIRST SIGN RECOGNIZED AS CORRECT (real verifier pass on fake feed)');
} else {
  mark('no verifier pass within 45s (fake feed is not an A-handshape — expected)');
  await page.getByRole('button', { name: /^Skip/i }).first().click({ force: true }).catch(() => {});
  mark('tap: Skip (stuck-learner escape to next sign)');
}

console.log('\n===== G2 FUNNEL =====');
for (const m of marks) console.log(`${String(m.t).padStart(6)}s  ${m.label}`);
const successMark = marks.find(m => m.label.includes('RECOGNIZED'));
const skipMark = marks.find(m => m.label.includes('Skip'));
const liveMark = marks.find(m => m.label.includes('live signing'));
const homeMark = marks.find(m => m.label.includes('Home visible'));
console.log(`\nTIME TO LIVE VIEW: ${liveMark?.t}s | TIME TO FIRST SUCCESS: ${successMark ? successMark.t + 's' : 'n/a (see skip floor)'}`);
if (skipMark && !successMark) {
  console.log(`STUCK-LEARNER ESCAPE (skip to next prompt): ${skipMark.t}s from cold load`);
  console.log(`HOME -> LIVE VIEW delta: ${(liveMark.t - homeMark.t).toFixed(1)}s`);
}
console.log(`90s THRESHOLD vs time-to-live-view: ${liveMark.t <= 90 ? 'MET' : 'EXCEEDED'}`);
await b.close();
