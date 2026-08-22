// hermes-perf-probe — ad-hoc measurement (NOT part of any suite)
// Measures the vision pipeline under (a) no throttle and (b) 6x CPU throttle, using the DEV
// server so window.__qsVisionPacer is exposed. Numbers are EMULATION numbers on desktop
// hardware — explicitly NOT physical-low-end-device results.
import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';
const results = {};

async function drive(page, { throttle, sampleMs }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
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
  console.log('=== BASELINE (no CPU throttle, desktop, headless software GL) ===');
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
