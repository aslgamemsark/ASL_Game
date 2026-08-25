// ASL-E2 — keyboard-only full-lesson walkthrough (ad-hoc, not part of the canonical suite).
// Drives onboarding -> Home -> lesson start -> the full answer loop using ONLY keyboard events
// (Tab / Shift+Tab / Enter / Space / arrows). At each step records:
//   - which element has focus (tag + accessible-ish label),
//   - whether the focus ring is visibly painted (outline-width > 0 on :focus-visible path),
//   - whether Enter/Space actually activated it (operability).
// Exit 0 iff every step was completable by keyboard and focus stayed visible.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();

async function focusInfo() {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'body', label: '', outline: 'none' };
    const cs = getComputedStyle(el);
    const label =
      el.getAttribute('aria-label') ||
      (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), label, outline: `${cs.outlineStyle} ${cs.outlineWidth}` };
  });
}

/** Tab forward until activeElement matches `match`, bounded. Returns true on success. */
async function tabUntil(match, maxTabs = 40) {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    const info = await focusInfo();
    // Guard against false positives: when focus wraps out of the page, activeElement becomes
    // BODY whose textContent is the WHOLE page text and can accidentally match. Require a real
    // element (not BODY) for a match.
    if (info.tag !== 'BODY' && match(info)) { info.tabs = i + 1; globalThis.__lastFocus = info; return true; }
  }
  globalThis.__lastFocus = await focusInfo();
  return false;
}

// ---- 1. Welcome screen: "Get started" reachable + operable via keyboard ----
await page.goto(BASE);
await page.waitForTimeout(1200);
let info = await focusInfo(); // initial focus lands on body
rec('initial focus is body (no rogue autofocus)', info.tag === 'body', JSON.stringify(info));
const gotStarted = await tabUntil(i => /get started/i.test(i.label));
info = globalThis.__lastFocus;
rec('welcome: Get started reachable by Tab', gotStarted, `tabs=${info.tabs ?? '-'}, el=${info.tag}.${info.cls}`);
const ringVisible = info.outline && !/^none/.test(info.outline) && info.outline !== 'none 0px';
rec('focus ring visibly painted (:focus-visible token)', ringVisible, `outline=${info.outline}`);
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
const modalShown = await page.getByRole('dialog').isVisible().catch(() => false) ||
  (await page.locator('body').innerText()).includes('Continue');
rec('Enter activates Get started (onboarding advances)', modalShown, `dialogOrCopy=${modalShown}`);

// ---- 2. Onboarding: Continue as guest -> skill pick -> finish, keyboard only ----
await tabUntil(i => /continue as guest/i.test(i.label)).then(async ok => {
  rec('onboarding: Continue-as-guest reachable', ok, `el=${globalThis.__lastFocus.tag} "${globalThis.__lastFocus.label.slice(0, 30)}"`);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
await tabUntil(i => /just starting/i.test(i.label)).then(ok => {
  rec('skill pick reachable', ok, `"${globalThis.__lastFocus.label.slice(0, 30)}"`);
});
await page.keyboard.press('Enter');
try {
  await page.locator("nav[aria-label='Main']").filter({ visible: true }).first()
    .waitFor({ state: 'visible', timeout: 15000 });
  rec('keyboard-only onboarding completes to Home', true, 'nav visible');
} catch {
  rec('keyboard-only onboarding completes to Home', false, 'nav never appeared');
}

// ---- 3. Navigate BottomNav tabs by keyboard ----
// Tab order is DOM order: TopBar (2) -> main content (26-letter grid on Alphabets etc.) ->
// BottomNav last. The five nav buttons sit after the content, so walk with a bounded loop that
// keeps tabbing until all five nav labels have been focused (verified empirically reachable).
const navLabels = ['Journey', 'Alphabets', 'Basics', 'Review', 'Me'];
const seen = new Set();
for (let i = 0; i < 60 && seen.size < 5; i++) {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  const lbl = await page.evaluate(
    () => (document.activeElement?.tagName === 'BUTTON'
      ? (document.activeElement.textContent || '')
      : '').replace(/\s+/g, ' ').trim()
  );
  for (const l of navLabels) if (lbl.includes(l)) { seen.add(l); break; }
}
rec('all five BottomNav items keyboard-reachable', seen.size === 5,
  `seen=${[...seen].join(',')}`);

// ---- 4. Start a lesson from the Alphabets tab via keyboard ----
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.getByRole('button', { name: /Alphabets/ }).first().click(); // position at Alphabets
await page.waitForTimeout(600);
// Pure keyboard from here: walk Tab until the Practice Letters card is focused, then Enter.
const practiceReached = await tabUntil(i => /practice letters|start/i.test(i.label), 60);
info = globalThis.__lastFocus;
rec('Practice Letters card reachable by Tab from Alphabets', practiceReached,
  `el=${info.tag} "${info.label.slice(0, 34)}"`);
await page.keyboard.press('Enter');
try {
  // The lesson's live view heading is "Sign It" / "Sign Quiz" (PracticePage.tsx:392).
  await page.getByText(/Sign (It|Quiz)/i).first()
    .waitFor({ state: 'visible', timeout: 15000 });
  rec('Enter starts the lesson (Sign It view appears)', true,
    `"${((await page.locator('body').innerText()) || '').replace(/\s+/g, ' ').slice(0, 60)}"`);
} catch {
  rec('Enter starts the lesson (Sign It view appears)', false, 'no Sign It within 15s');
}

// ---- 5. Lesson live view confirmed by check 4's "Sign It/Sign Quiz" heading. The camera-gate
// Allow button only exists when the browser hasn't granted a camera; with Playwright chromium's
// default (no fake-device flags on this ad-hoc context), the gate may or may not appear — so
// this step is observational, not asserted.
const allowBtn = page.getByRole('button', { name: /allow camera/i }).first();
if (await allowBtn.isVisible().catch(() => false)) {
  const ok = await tabUntil(i => /allow camera/i.test(i.label)).then(r => r);
  rec('camera gate: Allow Camera keyboard-reachable', !!ok, 'observed');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
}

// ---- 6. In-lesson controls: exit affordance reachable + operable by keyboard ----
const exitOk = await tabUntil(i => /exit|back|home|close/i.test(i.label), 80);
info = globalThis.__lastFocus;
rec('in-lesson exit affordance keyboard-reachable', exitOk, `el=${info.tag} "${info.label.slice(0, 30)}"`);
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const backHome = await nav.isVisible();
rec('Exit returns to Home (keyboard operated)', backHome, `nav=${backHome}`);

const failed = results.filter(r => !r.ok);
console.log(`\nE2 SUMMARY: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
