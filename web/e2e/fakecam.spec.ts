// Camera lesson E2E — canonical e2e since ASL-A8 (round-4, 2026-08-25). Was `e2e-adhoc/fakecam.spec.ts`,
// which never ran (outside testDir, no script, not in CI) even though it was the only end-to-end
// camera-pipeline test in the repo.
//
// Scoped to the `chromium` project: Chromium is the only engine here with a synthetic fake video
// device (--use-fake-device-for-media-stream, playwright.config.ts). WebKit/Safari has no
// equivalent flag, so on the ios project getUserMedia would reject and this spec could only ever
// assert "camera failed" — which the app's own error card already covers. The other specs in e2e/
// deliberately avoid camera flows for the same reason (see mobile.spec.ts's wasm-CDN filter note).
import { test, expect } from '@playwright/test';

test('camera lesson: fake cam activates preview + recognition pipeline without errors', async ({ page }) => {
  // Scoped to the `chromium` PROJECT by name, not engine: the android project also runs the
  // Chromium engine, but only the chromium project carries the --use-fake-device launch args
  // (playwright.config.ts), so there the camera legitimately cannot come up.
  test.skip(test.info().project.name !== 'chromium',
    'fake video device is configured only on the chromium project');

  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // Guest onboarding → Home.
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });

  // Alphabet tab → the one-click "Practice Letters" starter (AlphabetTab.tsx).
  await page.getByRole('button', { name: /Alphabets/ }).first().click();
  await page.getByRole('button', { name: /Practice Letters/i }).first().click();

  // First-lesson camera onboarding gate mounts when signup-camera-onboarded is unset.
  const allow = page.getByRole('button', { name: /Allow Camera/i });
  if (await allow.isVisible().catch(() => false)) await allow.click();

  // The dominant-hand "Quick Setup" gate mounts ASYNC (after getUserMedia resolves + the page
  // transitions), so a single isVisible() probe races it — wait for it to appear instead.
  const skipHand = page.getByRole('button', { name: /Skip for now/i });
  const appeared = await skipHand.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
  if (appeared) {
    await skipHand.click();
  }

  await expect(page.getByRole('heading', { name: /Sign It/i })).toBeVisible({ timeout: 30_000 });

  // With permissions auto-granted, the camera must come up — no error card may appear.
  await expect(
    page.getByText(/Camera access denied|Camera unavailable|isn't showing|Couldn't load the recognizer/i)
  ).toHaveCount(0, { timeout: 30_000 });

  // The hidden <video> element must be receiving frames from the fake camera.
  const dims = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { w: v.videoWidth, h: v.videoHeight, ready: v.readyState } : null;
  });
  expect(dims).not.toBeNull();
  expect(dims!.ready).toBeGreaterThanOrEqual(2);
  expect(dims!.w).toBeGreaterThan(0);

  // Signing phase is interactive: skip control present and prompt visible.
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();

  // No unexpected JS errors during the whole flow.
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
});
