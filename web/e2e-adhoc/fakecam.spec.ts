// hermes-fakecam-e2e — ad-hoc verification (NOT part of the canonical suite)
import { test, expect } from '@playwright/test';

async function enterAsGuest(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 15_000 });
}

test('camera lesson: fake cam activates preview + recognition pipeline without errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await enterAsGuest(page);
  await page.getByRole('button', { name: /Practice Letters/i }).click();

  // First-lesson camera onboarding gate
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
