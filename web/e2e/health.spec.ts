import { test, expect, type Page } from '@playwright/test';

// Runtime-health coverage that complements smoke.spec.ts's behavioral flow. These guard the class
// of defect that ships silently because nothing throws and the page still renders — e.g. the
// hardcoded Google Fonts URL that 404'd and dropped the whole app to a system fallback font
// (caught by a Playwright health pass, 2026-07-19). Everything here is reachable without a camera.

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
  test('landing page: loads, hero visible, no broken images, no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/landing.html', { waitUntil: 'networkidle' });
    await expect(page.locator('h1').first()).toBeVisible();
    const brokenImgs = await page.$$eval('img', (imgs) =>
      imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src')));
    expect(brokenImgs, 'broken images on landing').toEqual([]);
    expect(errors, 'console/network errors on landing').toEqual([]);
  });

  test('app boots as guest with no console errors or 4xx responses', async ({ page }) => {
    const errors = collectErrors(page);
    const bad: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await page.goto('/', { waitUntil: 'networkidle' });
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
    await page.goto('/', { waitUntil: 'networkidle' });
    // Fonts load lazily; wait for the FontFaceSet to settle before asserting availability.
    const loaded = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Quicksand'); });
    expect(loaded, 'Quicksand should be loaded, not falling back to system font').toBe(true);
    expect(thirdPartyFont, 'no third-party font requests (self-hosted)').toEqual([]);
  });

  test('an unknown route does not blank-screen', async ({ page }) => {
    await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
    const text = (await page.locator('body').innerText()).trim();
    expect(text.length, 'unknown route rendered a blank page').toBeGreaterThan(4);
  });
});
