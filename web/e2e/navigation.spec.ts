import { test, expect, type Page } from '@playwright/test';

/**
 * Hardware/browser Back button coverage (2026-07-30 audit): zero matches for
 * `popstate`/`pushState` anywhere in the app meant Android's Back button closed the app from any
 * screen — including mid-lesson — instead of navigating up one level, which is not how any native
 * Android app behaves. `page.goBack()` drives a real browser back navigation, exercising the same
 * `popstate` path the hardware button fires on Android and the TWA.
 *
 * Camera-dependent screens (Lesson/Practice/Story/Speed/Duel/Room) are out of scope here, same as
 * the rest of e2e/ — see playwright.config.ts's comment on why a fake video device is a separate
 * effort. This covers what's reachable without one: Settings/Leaderboard/Multiplayer-hub (a
 * non-home screen), a dialog opened on top of Home, and Back exhausted back to Home not exiting.
 */

async function reachHome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });
}

async function openFromProfileHub(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first().click();
  await page.getByRole('button', { name: new RegExp(`${label}$`) }).first().click();
}

test.describe('hardware/browser Back navigation', () => {
  test('Back from a non-home screen returns to Home instead of leaving the app', async ({ page }) => {
    await reachHome(page);
    await openFromProfileHub(page, 'Settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible();
    // Still the same document — Back was intercepted, not a real page unload.
    expect(page.url()).not.toBe('about:blank');
  });

  test('Back from Leaderboard (reached via the profile hub) returns to Home', async ({ page }) => {
    await reachHome(page);
    await openFromProfileHub(page, 'Leaderboard');
    await expect(page.getByRole('heading', { name: /leaderboard/i })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible();
  });

  test('Back inside the multiplayer hub returns to hub choices before reaching Home', async ({ page }) => {
    await reachHome(page);
    await openFromProfileHub(page, 'Multiplayer');
    // Signed-out guest sees the sign-in gate — the screen itself (not hub/duel/room) is still the
    // right level to assert Back returns to Home from directly, since guests can't reach duel/room.
    await expect(page.getByRole('heading', { name: /multiplayer/i })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible();
  });

  test('Back closes a dialog opened over Home without leaving Home', async ({ page }) => {
    await reachHome(page);
    const signInTrigger = page.getByRole('button', { name: /sign in/i }).first();
    await signInTrigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.goBack();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible();
  });

  test('Back twice from a screen opened over Home exhausts to Home, then the app (no crash)', async ({ page }) => {
    await reachHome(page);
    await openFromProfileHub(page, 'Settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible();

    // A second Back from Home has nothing left in our tracked stack — the browser's own default
    // takes over (in a real tab, that's leaving the page). Assert this doesn't throw/crash the
    // app; the navigation itself is exactly what should happen at the true root.
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  // Regression, 2026-08-05: closing a dialog and navigating the screen behind it in the SAME
  // click is a distinct case from the two above (Back on a screen; Back on a dialog) — it's what
  // "Try Yourself" on a sign/letter detail modal does, and it broke silently. The dialog's
  // useBackDismiss cleanup doesn't run until its exit animation finishes (measured ~576ms after
  // the click), by which point the screen-level useBackDismiss instance had already activated and
  // pushed its own history entry on top. The dialog's cleanup then unconditionally called
  // history.back(), popping the SCREEN's fresh entry instead of its own, and the resulting
  // popstate fired the screen instance's onBack (goHome) — silently reverting the navigation the
  // click had just triggered. See useBackDismiss.ts for the fix (only consume on cleanup if this
  // instance's entry is still the current top of the stack when cleanup actually runs).
  test('Closing a dialog while navigating away in the same click reaches the new screen and stays there', async ({ page }) => {
    await reachHome(page);
    await page.getByRole('button', { name: /Basic Signs/i }).first().click();
    await expect(page.getByText(/tap a sign to see it performed/i)).toBeVisible();

    // Accessible name is "HELLO →" (the tile also renders a trailing arrow glyph), hence no anchors.
    await page.getByRole('button', { name: /hello/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /try yourself/i }).click();

    // Must both leave the Basic Signs screen AND stay away from it — the bug's signature was a
    // clean-looking navigation that silently reverted a beat later, so a single immediate
    // assertion right after the click would not have caught it.
    await expect(page.getByText(/tap a sign to see it performed/i)).not.toBeVisible();
    await page.waitForTimeout(900); // covers the ~576ms exit-animation window the bug lived in
    await expect(page.getByText(/tap a sign to see it performed/i)).not.toBeVisible();
  });
});
