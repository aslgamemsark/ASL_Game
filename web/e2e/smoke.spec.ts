import { test, expect } from '@playwright/test';

// Covers what's reachable without a real camera device (see playwright.config.ts comment):
// first paint, the full onboarding flow as a guest, landing on Home, and the sign-in modal's
// accessibility behavior (complementing ModalShell's unit-level verification from the H3 fix —
// this is the real thing, in a real browser, with real keyboard events).
test.describe('app smoke test', () => {
  test('loads and shows the welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome to SignUp')).toBeVisible();
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible();
  });

  test('a guest can complete onboarding and reach Home', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /continue as guest/i }).click();

    // Skill-level picker — pick the first option.
    await expect(page.getByText(/how much asl do you know/i)).toBeVisible();
    await page.locator('button', { hasText: /./ }).first().click();

    // Onboarding's own "done" celebration auto-advances to Home after ~1.4s (see
    // OnboardingFlow.tsx's setTimeout(onComplete, 1400)).
    await expect(page.getByRole('button', { name: /sign in/i }).or(page.getByText(/streak/i)))
      .toBeVisible({ timeout: 10_000 });
  });

  test('sign-in modal opens with correct dialog semantics and closes on Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /continue as guest/i }).click();
    await page.locator('button', { hasText: /./ }).first().click();
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
