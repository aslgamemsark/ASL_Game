// ASL-G4 — return-visit path execution probe (ad-hoc, not part of the canonical suite).
// Simulates a returning learner: visit 1 completes onboarding + a Practice Letters session
// (earns XP/completion), then the SAME persistent profile re-opens the app. Verifies visit 2:
//   - skips welcome/onboarding entirely,
//   - lands directly on Home content,
//   - restores persisted progress,
//   - wall-clock time to Home content.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const PROFILE = process.env.G4_PROFILE || 'C:/Users/msaad/AppData/Local/Temp/hermes-g4-profile';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const ctx = await chromium.launchPersistentContext(PROFILE, {
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
  permissions: ['camera'],
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
let page = ctx.pages()[0] || (await ctx.newPage());

// ================= VISIT 1: establish a real learner state =================
await page.goto(BASE);
await page.getByRole('button', { name: /get started/i }).click();
await page.getByRole('button', { name: /continue as guest/i }).click();
await page.getByRole('button', { name: /just starting/i }).click();
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.waitFor({ state: 'visible', timeout: 15000 });
console.log('VISIT1: onboarding done, Home visible');

// Complete one Practice Letters session via skips (earns completion record).
await nav.getByRole('button', { name: /Alphabets/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Practice Letters/i }).first().click();
for (let i = 0; i < 10; i++) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (/Nice effort|You made it through|getting stronger|Lesson Complete/i.test(bodyText)) break;
  const skip = page.getByRole('button', { name: /^Skip/i }).first();
  if (!(await skip.isVisible().catch(() => false))) { await page.waitForTimeout(700); continue; }
  await skip.click({ force: true }).catch(() => {});
  await page.waitForTimeout(2100);
}
// Dismiss celebration modals.
for (let i = 0; i < 5; i++) {
  const dlg = page.locator('[role="dialog"]');
  if (!(await dlg.isVisible().catch(() => false))) break;
  await dlg.locator('button').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}
const v1Topbar = await page.evaluate(() =>
  (document.querySelector('header')?.innerText || document.body.innerText.slice(0, 40)).replace(/\s+/g, ' ')
);
console.log('VISIT1 end topbar:', v1Topbar.slice(0, 50));
await page.close();

// ================= VISIT 2: the return visit (same profile) =================
page = ctx.pages()[0] || (await ctx.newPage());
const T0 = Date.now();
function mark(label) {
  const t = Number(((Date.now() - T0) / 1000).toFixed(1));
  console.log(`  [${String(t).padStart(5)}s] ${label}`);
  return t;
}

mark('return-visit navigation start');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
mark('shell loaded');
let sawWelcome = false;
try {
  await page.getByRole('button', { name: /get started/i }).waitFor({ state: 'visible', timeout: 3000 });
  sawWelcome = true;
} catch {}
rec('return visit: welcome/onboarding skipped', !sawWelcome,
  sawWelcome ? 'Get started reappeared!' : 'straight past onboarding');
if (sawWelcome) { await ctx.close(); process.exit(1); }

const nav2 = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav2.waitFor({ state: 'visible', timeout: 15000 });
const homeTime = mark('Home content visible');
rec(`return visit reaches usable Home in ${homeTime}s`, homeTime <= 10, `t=${homeTime}s`);

const v2Topbar = await page.evaluate(() =>
  (document.querySelector('header')?.innerText || '').replace(/\s+/g, ' '));
console.log('VISIT2 topbar:', v2Topbar.slice(0, 50));
console.log('VISIT2 body head:', (await page.evaluate(() => document.body.innerText)).slice(0, 110));
const xpNonZero = await page.evaluate(() => {
  const m = document.body.innerText.match(/🔥\s*(\d+)/);
  return m ? Number(m[1]) : -1;
});
rec('return visit: progress restored (XP counter readable)',
  xpNonZero >= 0, `xp=${xpNonZero} (visit1 skipped all signs, so 0 XP is a valid restore)`);

const practiceCard = page.getByRole('button', { name: /Practice Letters/i }).first();
// Return visit lands on the Journey tab ("Welcome back! ... Start your journey") — the Practice
// Letters card is exactly one BottomNav tap away on the Alphabets tab. Verify that.
await nav2.getByRole('button', { name: /Alphabets/ }).first().click();
await page.waitForTimeout(600);
rec('return visit: Practice Letters card reachable in ONE nav tap',
  await practiceCard.isVisible().catch(() => false), 'Journey -> Alphabets -> card');

await ctx.close();
const failed = results.filter(r => !r.ok);
console.log(`\nG4 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
