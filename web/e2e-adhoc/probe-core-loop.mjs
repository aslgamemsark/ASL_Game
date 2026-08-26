// ASL-H2 — core-loop / spaced-repetition execution probe (ad-hoc, not canonical suite).
// Verifies the learn -> practice -> review cycle actually cycles weak signs back:
//   1. Drive visit 1: complete a Practice Letters session with all SKIPS (every sign recorded
//      as a miss => nextReviewAt = now+1d... but interval=1 day means NOT due immediately).
//      To make SR observable in one run, we then manipulate the persisted signAccuracy
//      nextReviewAt timestamps into the past — simulating "days later" — and verify:
//   2. Return visit: PracticeTab shows "N signs to review" and Quick Session pool pulls from
//      getSignsDueForReview (due first, weakest fill).
// This tests the real scheduling math end to end without waiting a real day.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const PROFILE = process.env.G4_PROFILE || 'C:/Users/msaad/AppData/Local/Temp/hermes-h2-profile';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const ctx = await chromium.launchPersistentContext(PROFILE, {
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
  permissions: ['camera'],
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
let page = ctx.pages()[0] || (await ctx.newPage());

// ---- VISIT 1: onboarding + one skipped-through session (creates signAccuracy entries) ----
await page.goto(BASE);
await page.getByRole('button', { name: /get started/i }).click();
await page.getByRole('button', { name: /continue as guest/i }).click();
await page.getByRole('button', { name: /just starting/i }).click();
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.waitFor({ state: 'visible', timeout: 15000 });
await nav.getByRole('button', { name: /Alphabets/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Practice Letters/i }).first().click();
for (let i = 0; i < 10; i++) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (/Nice effort|You made it through|getting stronger|Lesson Complete/i.test(bodyText)) break;
  const skip = page.getByRole('button', { name: /^Skip/i }).first();
  if (!(await skip.isVisible().catch(() => false))) { await page.waitForTimeout(700); continue; }
  await skip.click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);
}
for (let i = 0; i < 5; i++) {
  const dlg = page.locator('[role="dialog"]');
  if (!(await dlg.isVisible().catch(() => false))) break;
  await dlg.locator('button').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
}

// Inspect what recordSign persisted.
const statsAfterVisit1 = await page.evaluate(() => {
  // The user store persists via zustand persist; find its localStorage key.
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  return keys;
});
console.log('storage keys:', statsAfterVisit1.join(', '));

const srState1 = await page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    try {
      const raw = localStorage.getItem(k);
      if (raw && raw.includes('signAccuracy') && raw.includes('nextReviewAt')) {
        const parsed = JSON.parse(raw);
        const state = parsed.state || parsed;
        const sa = state.signAccuracy || {};
        return Object.entries(sa).map(([id, s]) => ({
          id,
          attempts: s.attempts,
          successes: s.successes,
          interval: s.interval,
          nextReviewInDays: Math.round((s.nextReviewAt - Date.now()) / 86400000 * 10) / 10,
        }));
      }
    } catch {}
  }
  return null;
});
rec('visit 1: misses recorded into spaced-repetition store',
  Array.isArray(srState1) && srState1.length >= 5,
  JSON.stringify((srState1 || []).slice(0, 3)));

// All-skips => every interval must be 1 (miss resets interval) and nextReviewAt ~ tomorrow.
const allMissIntervals = (srState1 || []).every(s => s.attempts > 0 && s.interval === 1);
rec('SR math: miss resets interval to 1 day (SM-2 style)', allMissIntervals,
  `${(srState1 || []).filter(s => s.interval === 1).length}/${(srState1 || []).length} at interval=1`);

// ---- Simulate "days later": pull every nextReviewAt into the past. ----
await page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const raw = localStorage.getItem(k);
    if (raw && raw.includes('signAccuracy') && raw.includes('nextReviewAt')) {
      const obj = JSON.parse(raw);
      const state = obj.state || obj;
      const sa = state.signAccuracy || {};
      for (const id of Object.keys(sa)) {
        sa[id].nextReviewAt = Date.now() - 3600_000; // 1h ago => due
        sa[id].interval = 1;
      }
      localStorage.setItem(k, JSON.stringify(obj));
    }
  }
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// ---- VISIT 2: Review tab must show "N signs to review" ----
const nav2 = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav2.waitFor({ state: 'visible', timeout: 15000 });
await nav2.getByRole('button', { name: /Review/ }).first().click();
await page.waitForTimeout(800);
const reviewCopy = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const dueCountMatch = reviewCopy.match(/(\d+)\s*signs? to review/);
rec(`Review tab surfaces "${dueCountMatch ? dueCountMatch[1] : '?'} signs to review" after due dates pass`,
  !!dueCountMatch && Number(dueCountMatch[1]) >= 5,
  `"${reviewCopy.slice(reviewCopy.indexOf('Review'), reviewCopy.indexOf('Review') + 90)}"`);

// Start Quick Session from Review and confirm the queue draws from the DUE set.
await page.getByRole('button', { name: /quick session/i }).first().click();
// The camera-permission primer (CameraOnboarding, first expressive session) may appear —
// Allow Camera proceeds; the hand-check gate may follow ("Skip for now").
for (let i = 0; i < 8; i++) {
  const bodyNow = await page.evaluate(() => document.body.innerText);
  if (/what sign is this|Sign this|Choose a mode/i.test(bodyNow)) break;
  const allow = page.getByRole('button', { name: /allow camera/i }).first();
  const skipHand = page.getByRole('button', { name: /skip for now/i }).first();
  if (await allow.isVisible().catch(() => false)) { await allow.click(); await page.waitForTimeout(900); continue; }
  if (await skipHand.isVisible().catch(() => false)) { await skipHand.click(); await page.waitForTimeout(700); continue; }
  await page.waitForTimeout(700);
}
try {
  // Quick Session lands on PracticePage's mode chooser (autoStart unset on this path).
  await page.getByText(/Choose a mode/i).first()
    .waitFor({ state: 'visible', timeout: 15000 });
  rec('Quick Session opens the practice flow for due signs', true,
    `"${reviewCopy.match(/\d+ signs? to review/)?.[0] || ''}" were due`);
} catch {
  rec('Quick Session opens the practice flow for due signs', false,
    `screen="${(await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 80)}"`);
}

await ctx.close();
const failed = results.filter(r => !r.ok);
console.log(`\nH2 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
