// hermes-perf-probe — ad-hoc measurement (NOT part of any suite)
// Measures the vision pipeline under (a) no throttle and (b) 6x CPU throttle, against
// `vite preview` (the PRODUCTION build — the classifier only loads there; see
// config/classifier.ts). Numbers are EMULATION numbers on desktop hardware — explicitly NOT
// physical-low-end-device results.
//
// ASL-A3 fixes vs the round-2 version of this file:
//   1. BASE comes from PERF_BASE env var, default http://localhost:4173 (`vite preview`'s
//      port) instead of a hardcoded dev-server port 5199.
//   2. The page is loaded with ?debug=1 so isClassifierDebugEnabled() exposes
//      window.__qsVisionPacer in the production bundle.
//   3. The probe ASSERTS the TF.js classifier actually loaded before sampling — the round-2
//      numbers were invalid because the classifier never loaded under `vite dev`.
import { chromium } from 'playwright';

const BASE = process.env.PERF_BASE || 'http://localhost:4173';
const results = {};

async function drive(page, { throttle, sampleMs }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/?debug=1');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await page.getByRole('button', { name: /sign in/i }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /Practice Letters/i }).click();
  const allow = page.getByRole('button', { name: /Allow Camera/i });
  if (await allow.isVisible().catch(() => false)) await allow.click();
  const skipHand = page.getByRole('button', { name: /Skip for now/i });
  if (await skipHand.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
    await skipHand.click();
  }
  await page.getByRole('heading', { name: /Sign It/i }).waitFor({ timeout: 30000 });

  // ASL-A3: the classifier's load status must RESOLVE before sampling. Today the shipped
  // model is deliberately disabled (vite.config deletes dist/models/signs — model_v4 was
  // out-of-distribution), so 'disabled' is the expected production status and the probe
  // records it rather than failing; if the classifier is ever re-enabled, any status other
  // than 'ready'/'disabled' (i.e. stuck loading or errored) still fails the run.
  await page.waitForFunction(() => {
    const s = window.__classifierStatus;
    return s === 'ready' || s === 'disabled' || s === 'error' || s === 'unsupported';
  }, { timeout: 45000 });
  const classifierStatus = await page.evaluate(() => window.__classifierStatus);
  if (!classifierStatus) {
    throw new Error('Classifier status never resolved — measurement context invalid.');
  }

  // Give the loop a moment to start processing frames.
  await page.waitForFunction(() => {
    const p = window.__qsVisionPacer;
    return p && p.framesProcessed > 10;
  }, { timeout: 30000 });

  if (throttle) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }

  // Install an rAF counter + longtask observer in the page, then sample.
  await page.evaluate(() => {
    window.__probe = { raf: 0, longTasks: 0, durations: [] };
    const count = () => { window.__probe.raf++; requestAnimationFrame(count); };
    requestAnimationFrame(count);
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { window.__probe.longTasks++; window.__probe.durations.push(e.duration); }
    }).observe({ entryTypes: ['longtask'] });
  });

  const t0 = Date.now();
  const startPacer = await page.evaluate(() => ({
    frames: window.__qsVisionPacer.framesProcessed, tier: window.__qsVisionPacer.tier,
  }));
  await page.waitForTimeout(sampleMs);
  const end = await page.evaluate(() => ({
    pacer: {
      frames: window.__qsVisionPacer.framesProcessed,
      tier: window.__qsVisionPacer.tier,
      medianCost: Math.round(window.__qsVisionPacer.medianCost * 10) / 10,
    },
    probe: { raf: window.__probe.raf, longTasks: window.__probe.longTasks },
    t: Date.now(),
  }));

  const wall = (end.t - t0) / 1000;
  return {
    classifier: classifierStatus,
    visionFps: Math.round(((end.pacer.frames - startPacer.frames) / wall) * 10) / 10,
    rafFps: Math.round((end.probe.raf / wall) * 10) / 10,
    tier: end.pacer.tier,
    medianInferenceMs: end.pacer.medianCost,
    longTasks: end.probe.longTasks,
    jsErrors: errors,
  };
}

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

// Fresh context per scenario: localStorage persists onboarding completion, and the throttled
// run must walk the same entry path.
async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  return { ctx, page: await ctx.newPage() };
}

{
  const { ctx, page } = await freshPage();
  console.log('=== BASELINE (no CPU throttle, desktop, headless software GL, PREVIEW BUILD) ===');
  results.baseline = await drive(page, { throttle: 0, sampleMs: 12000 });
  console.log(JSON.stringify(results.baseline, null, 2));
  await ctx.close();
}
{
  const { ctx, page } = await freshPage();
  console.log('=== THROTTLED 6x CPU (low-end emulation) ===');
  results.throttled6x = await drive(page, { throttle: 6, sampleMs: 20000 });
  console.log(JSON.stringify(results.throttled6x, null, 2));
  await ctx.close();
}

await browser.close();
console.log('=== SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
