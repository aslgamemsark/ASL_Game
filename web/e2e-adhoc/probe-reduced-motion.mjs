// ASL-D5 — reduced-motion execution probe (ad-hoc, not part of the canonical suite).
// Emulates prefers-reduced-motion: reduce, loads the production build, and samples the DOM for
// RUNNING CSS animations + framer-motion transform churn on ambient components. Then repeats with
// no preference as the control. Prints per-phase counts; exit 1 if reduced mode shows running
// infinite CSS animations (the class of gap this audit hunts).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const SAMPLES = 6;
const GAP_MS = 700;

async function sample(page) {
  return page.evaluate(() => {
    const running = [];
    for (const el of document.querySelectorAll('*')) {
      const anims = el.getAnimations ? el.getAnimations({ subtree: false }) : [];
      for (const a of anims) {
        if (a.playState === 'running') {
          const name = a.animationName || a.constructor.name || 'anim';
          running.push(`${el.tagName}.${(el.className && el.className.toString().slice(0, 30)) || ''}:${name}`);
        }
      }
    }
    // framer-motion leaves inline transforms; an element whose matrix keeps changing between
    // samples means a JS-driven loop is still running.
    const moving = [];
    for (const el of document.querySelectorAll('[style*="transform"]')) {
      const t = el.style.transform;
      if (t && t !== 'none') moving.push(t.slice(0, 60));
    }
    return { cssRunning: running.slice(0, 12), cssCount: running.length, transforms: moving.length };
  });
}

async function walk(label) {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: label === 'reduce' ? 'reduce' : 'no-preference',
  });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.getByRole('button', { name: /get started/i }).click();
  await p.getByRole('button', { name: /continue as guest/i }).click();
  await p.getByRole('button', { name: /just starting/i }).click();
  await p.locator("nav[aria-label='Main']").last().waitFor({ state: 'visible', timeout: 15000 });
  // Settle past entrance animations, then sample Home several times.
  await p.waitForTimeout(2500);
  const home = [];
  for (let i = 0; i < SAMPLES; i++) { home.push(await sample(p)); await p.waitForTimeout(GAP_MS); }
  // Me tab (Zippy avatar, streak flame, sparkle hover targets live there).
  await p.locator("nav[aria-label='Main']").last().getByRole('button', { name: /Me/ }).first().click();
  await p.waitForTimeout(2000);
  const me = [];
  for (let i = 0; i < SAMPLES; i++) { me.push(await sample(p)); await p.waitForTimeout(GAP_MS); }
  console.log(`[${label}] HOME css-running total across ${SAMPLES} samples:`, home.reduce((s, x) => s + x.cssCount, 0));
  console.log(`[${label}] HOME distinct running names:`, [...new Set(home.flatMap(x => x.cssRunning))].slice(0, 8));
  console.log(`[${label}] HOME transform-bearing elements (last sample):`, home[SAMPLES - 1].transforms);
  console.log(`[${label}] ME   css-running total across ${SAMPLES} samples:`, me.reduce((s, x) => s + x.cssCount, 0));
  console.log(`[${label}] ME   distinct running names:`, [...new Set(me.flatMap(x => x.cssRunning))].slice(0, 8));
  console.log(`[${label}] ME   transform-bearing elements (last sample):`, me[SAMPLES - 1].transforms);
  await b.close();
  return { home, me };
}

const reduced = await walk('reduce');
const normal = await walk('normal');

const reducedCss = reduced.home.reduce((s, x) => s + x.cssCount, 0) + reduced.me.reduce((s, x) => s + x.cssCount, 0);
console.log('\nVERDICT: running CSS animations under reduce =', reducedCss);
process.exit(reducedCss > 0 ? 1 : 0);
