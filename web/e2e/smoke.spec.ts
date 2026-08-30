import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

// Covers what's reachable without a real camera device (see playwright.config.ts comment):
// first paint, the full onboarding flow as a guest, landing on Home, and the sign-in modal's
// accessibility behavior (complementing ModalShell's unit-level verification from the H3 fix —
// this is the real thing, in a real browser, with real keyboard events).
test.describe('app smoke test', () => {
  test('loads and shows the welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome to QuickSign')).toBeVisible();
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible();
  });

  test('a guest can complete onboarding and reach Home', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /get started/i }).click();
    // The 'auth' step (and this guest button) only renders when Supabase is configured
    // (OnboardingFlow.tsx) — without it, "Get Started" routes straight to the skill-level step
    // below, which is exactly the environment CI's `e2e` job runs in (deliberately unconfigured,
    // see ci.yml). Conditional rather than a hard assertion so this test covers both real
    // environments instead of only ever passing in one of them.
    const guestButton = page.getByRole('button', { name: /continue as guest/i });
    if (await guestButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await guestButton.click();
    }

    // Skill-level picker — pick the first option.
    await expect(page.getByText(/how much asl do you know/i)).toBeVisible();
    await page.getByRole('button', { name: /just starting/i }).click();

    // The dominant-hand picker used to be an onboarding step here. It moved into PracticePage
    // (2026-07-28 rework) — it needs a live camera, which onboarding deliberately no longer opens.
    // This test asserted it was still in the flow, so the suite has been red since that landed.

    // Onboarding's own "done" celebration auto-advances to Home after ~1.4s (see
    // OnboardingFlow.tsx's setTimeout(onComplete, 1400)). The guest sign-in affordance in the
    // top bar is a stable Home marker (.first() avoids strict-mode on repeated "streak" text).
    await expect(page.getByRole('button', { name: /sign in/i }).first())
      .toBeVisible({ timeout: 10_000 });
  });

  test('sign-in modal opens with correct dialog semantics and closes on Escape', async ({ page }) => {
    await completeOnboarding(page);
    await page.waitForTimeout(1600); // clear onboarding's auto-advance

    const signInTrigger = page.getByRole('button', { name: /sign in/i }).first();
    await signInTrigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
