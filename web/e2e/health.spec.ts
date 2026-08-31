import { test, expect, type Page } from '@playwright/test';

// Runtime-health coverage that complements smoke.spec.ts's behavioral flow. These guard the class
// of defect that ships silently because nothing throws and the page still renders — e.g. the
// hardcoded Google Fonts URL that 404'd and dropped the whole app to a system fallback font
// (caught by a Playwright health pass, 2026-07-19). Everything here is reachable without a camera.

// `waitUntil: 'load'` everywhere below, not 'networkidle' (changed 2026-08-31): this app has
// long-lived background network activity by design (PostHog, geo-IP lookups, MediaPipe/model
// polling on some screens), so 'networkidle' either never resolves or resolves only once the
// machine has spare capacity to let those settle — under any real concurrent load (the whole suite
// running, not just this file) it reliably timed out at 60s, always on this file, never on a real
// assertion failure. Every test below already asserts on real, specific content afterward
// (visible text, an element, a captured request list) — that assertion IS the synchronization
// point; waiting for total network silence first was redundant and, empirically, the less reliable
// of the two. Playwright's own docs discourage 'networkidle' for exactly this reason.
//
// Third-party / expected noise we don't want to fail on.
const IGNORE = [/React DevTools/i, /\[vite\]/i, /Service Worker/i, /workbox/i, /manifest/i];
const benign = (t: string) => IGNORE.some((re) => re.test(t));

/** Attach console-error + pageerror + failed-request collectors; returns the live error array. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    // Supabase/geo lookups can legitimately fail in a hermetic test env; ignore those hosts.
    if (!benign(u) && !u.includes('supabase') && !u.includes('ipwho') && !u.includes('ipapi')) {
      errors.push(`requestfailed: ${u} — ${r.failure()?.errorText ?? ''}`);
    }
  });
  return errors;
}

test.describe('runtime health', () => {
  // `/` -> public/home.html and the `/landing.html` -> `/` 301 are both Vercel-edge behavior
  // (vercel.json rewrites/redirects) that `vite preview` — what this suite's webServer runs
  // (see playwright.config.ts) — never applies; only the real Vercel deploy does. So this hits the
  // static file directly (Vite copies public/* into dist/ verbatim, unchanged by the rewrite), and
  // the rewrite/redirect topology itself is verified with live curl checks against the deployed
  // preview instead (see the launch-readiness plan's Verification section) — not here, where it
  // would just silently fail on every run for a reason unrelated to what it's meant to catch.
  test('landing page: loads, hero visible, no broken images, no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/home.html', { waitUntil: 'load' });
    await expect(page.locator('h1').first()).toBeVisible();
    const brokenImgs = await page.$$eval('img', (imgs) =>
      imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src')));
    expect(brokenImgs, 'broken images on landing').toEqual([]);
    expect(errors, 'console/network errors on landing').toEqual([]);
  });

  // Same vite-preview caveat as the landing test above: /asl-alphabet (the clean URL) only exists
  // via vercel.json's rewrite, which this local build doesn't apply — hits the underlying static
  // file directly instead. The clean-URL redirect/rewrite pair is a live curl check, not this.
  test('asl-alphabet page: loads, hero visible, no broken images, no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/asl-alphabet.html', { waitUntil: 'load' });
    await expect(page.locator('h1').first()).toBeVisible();
    const brokenImgs = await page.$$eval('img', (imgs) =>
      imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src')));
    expect(brokenImgs, 'broken images on asl-alphabet').toEqual([]);
    expect(errors, 'console/network errors on asl-alphabet').toEqual([]);
  });

  // The app itself now lives at /app, not / — see the Phase A URL migration.
  test('app boots as guest with no console errors or 4xx responses', async ({ page }) => {
    const errors = collectErrors(page);
    const bad: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await page.goto('/app', { waitUntil: 'load' });
    await expect(page.getByText(/Welcome to QuickSign/i)).toBeVisible();
    expect(bad, '4xx/5xx responses on app boot').toEqual([]);
    expect(errors, 'console/network errors on app boot').toEqual([]);
  });

  test('brand font (Quicksand) actually loads — self-hosted, no third-party font request', async ({ page }) => {
    const thirdPartyFont: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.includes('fonts.gstatic.com') || u.includes('fonts.googleapis.com')) thirdPartyFont.push(u);
    });
    await page.goto('/app', { waitUntil: 'load' });
    // Fonts load lazily; wait for the FontFaceSet to settle before asserting availability.
    const loaded = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Quicksand'); });
    expect(loaded, 'Quicksand should be loaded, not falling back to system font').toBe(true);
    expect(thirdPartyFont, 'no third-party font requests (self-hosted)').toEqual([]);
  });

  test('an unknown route does not blank-screen', async ({ page }) => {
    await page.goto('/this-route-does-not-exist', { waitUntil: 'load' });
    const text = (await page.locator('body').innerText()).trim();
    expect(text.length, 'unknown route rendered a blank page').toBeGreaterThan(4);
  });

  // Analytics privacy guard: this test env has no VITE_POSTHOG_KEY set (see analytics/client.ts's
  // gating), so zero requests to PostHog should ever fire from the APP — a regression here would
  // mean either the gate broke, or something started capturing before consent/config were ready.
  // Targets /app specifically: the static marketing page at / has its own hardcoded PostHog key
  // (by design — it predates the app bundle and has no env/build step to read from) and fires
  // regardless of this test env's config, so it is not this test's concern.
  test('no PostHog network activity when analytics is unconfigured', async ({ page }) => {
    const posthogRequests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('.i.posthog.com')) posthogRequests.push(r.url()); });
    await page.goto('/app', { waitUntil: 'load' });
    await page.getByRole('button', { name: /get started/i }).click().catch(() => {});
    expect(posthogRequests, 'PostHog request fired without a configured key').toEqual([]);
  });
});
