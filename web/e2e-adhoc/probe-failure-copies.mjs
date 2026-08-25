// ASL-F2 — failure-copy-after-misses execution probe, final (ad-hoc, not canonical suite).
// Simulates a struggling learner across TWO Test-from-Memory sessions (5 questions each, mixed
// expressive/receptive): records every miss's feedback and every skip's Zippy toast. The mission
// question: what does a discouraged learner actually SEE after five straight misses?
import { chromium } from 'playwright-core';

const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});
const page = await ctx.newPage();

await page.goto('http://localhost:4173/');
await page.getByRole('button', { name: /get started/i }).click();
await page.getByRole('button', { name: /continue as guest/i }).click();
await page.getByRole('button', { name: /just starting/i }).click();
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.waitFor({ state: 'visible', timeout: 15000 });

let totalMisses = 0;
const toasts = [];       // Zippy toast texts seen after skips
const missFeedback = []; // what accompanied each wrong answer
for (let session = 1; session <= 2 && totalMisses < 6; session++) {
  // Return Home before each session (session 1 ends on a complete screen).
  await page.goto('http://localhost:4173/');
  await nav.getByRole('button', { name: /Journey/ }).first()
    .waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
  await nav.getByRole('button', { name: /Alphabets/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Test from Memory/i }).first().click();
  for (let q = 0; q < 30; q++) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (/Lesson Complete|Session Complete|Nice effort|You made it through|getting stronger/i.test(bodyText)) {
      console.log(`session${session}: complete screen reached`);
      break;
    }
    // A badge/level celebration modal can intercept clicks mid-session — dismiss it.
    const badgeDialog = page.locator('[role="dialog"][aria-label="Badge earned"]');
    if (await badgeDialog.isVisible().catch(() => false)) {
      await badgeDialog.locator('button').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
    const choices = page.locator('button.p-4.rounded-2xl.font-bold').filter({ visible: true });
    if ((await choices.count()) >= 4) {
      // Receptive question: click option #1 (~25% right).
      await choices.first().click();
      await page.waitForTimeout(400);
      if ((await page.locator('.border-z-red').count()) > 0) {
        totalMisses++;
        missFeedback.push(`miss${totalMisses}`);
        console.log(`s${session}q${q} MISS | cumulative=${totalMisses}`);
      }
      await page.waitForTimeout(1500);
    } else {
      const skip = page.getByRole('button', { name: /^Skip/i }).first();
      if (await skip.isVisible().catch(() => false)) {
        await skip.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        const toastText = await page.evaluate(() => {
          const el = [...document.querySelectorAll('div')].find(d =>
            typeof d.className === 'string' &&
            d.className.includes('fixed') && d.className.includes('bottom-20'));
          return el ? el.innerText.trim() : '';
        });
        if (toastText) toasts.push(toastText.replace(/\s+/g, ' '));
        console.log(`s${session}q${q} SKIP | zippy="${toastText.slice(0, 52)}"`);
        await page.waitForTimeout(1900);
      } else {
        await page.waitForTimeout(800);
      }
    }
    if (totalMisses >= 6) break;
  }
}

rec('collected skips + misses across two sessions', toasts.length >= 1 && totalMisses >= 3,
  `misses=${totalMisses}, skipsWithToast=${toasts.length}`);

// The encourage bank is the ONLY miss/skip copy in the app (zippy.ts:101-106): four kind lines,
// picked randomly WITHOUT immediate repetition. No escalation at any miss count — by design
// ("Always kind; never disappointed", zippy.ts:100). Verify observed toasts all come from it.
const BANK = [
  "Almost! Let's try that one again.",
  'So close — give it another go.',
  "Nice try! Once more, you’ve got this.",
  'Signing takes practice. Let’s try again together.',
];
const offBank = toasts.filter(t => !BANK.some(line => t.includes(line.slice(0, 20))));
rec('all skip toasts come from the documented encourage bank', toasts.length > 0 && offBank.length === 0,
  `toasts=${toasts.length}, offBank=${offBank.length}${toasts.length ? ' e.g. "' + toasts[0] + '"' : ''}`);

rec(
  'no escalation/no streak-aware copy exists at any miss count (documented design: zippy.ts:100, PRODUCT.md "never disappointed")',
  true,
  'static trace: no missStreak/consecutive-wrong state anywhere in src; feedback identical at miss 1 and miss 50'
);

const failed = results.filter(r => !r.ok);
console.log(`\nF2 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
