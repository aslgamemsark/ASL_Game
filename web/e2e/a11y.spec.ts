import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility sweep over every screen reachable without a camera device.
 *
 * Why axe rather than another hand-written audit: colour contrast on this project is now covered
 * mechanically (tests/tokenContrast.test.ts), but operability — keyboard reachability, dialog
 * semantics, accessible names, heading order — was never measured at all. A one-off manual audit
 * of that surface rots the moment a new screen ships; a rule engine run in CI does not.
 *
 * Scope note: contrast rules are DISABLED here. They cannot see through a canvas or a video
 * element, and the two surfaces that matter most on this app (the webcam mirror, the reference
 * clips) are exactly that — axe would report the plate as a solid colour and miss the point
 * entirely. Contrast is owned by the unit tests, which compute it from the shipped stylesheet
 * against both frame extremes. This spec owns everything else.
 */

/** Serious/critical only. Minor + moderate findings are logged but do not fail — this is a gate
 *  against real barriers, not a style linter, and a noisy gate gets disabled. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

async function scan(page: import('@playwright/test').Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .analyze();

  // Compared as compact strings, not as the raw violation objects: axe's node objects are enormous
  // and a `toEqual([])` on them buries the actual finding under hundreds of lines of diff.
  const blocking = violations
    .filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))
    .flatMap((v) =>
      v.nodes.map((n) => `[${v.impact}] ${v.id} — ${v.help} @ ${n.target.join(' ')}`)
    );

  expect(blocking, `${label}: ${blocking.length} serious/critical a11y violation(s)`).toEqual([]);
}

/**
 * Walks the guest onboarding path and lands on Home.
 *
 * The completion marker is the BottomNav, not a "Sign in" button: onboarding routes a self-declared
 * beginner to the Alphabets tab rather than Journey (App.tsx's handleOnboardingComplete), and at
 * this viewport the guest sign-in affordance lives on the Me tab rather than in the chrome. The nav
 * is the one thing present on every Home tab.
 */
async function reachHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });
}

test.describe('accessibility', () => {
  // Pinned to a phone viewport. The app is mobile-first (`max-w-lg mx-auto`) and swaps navigation
  // at `lg`: BottomNav below it, SideNav above, with different labels ("Basics" vs "Basic Signs",
  // "Duel" vs "Multiplayer") and Shop reachable only via a top-bar icon on desktop. Scanning one
  // breakpoint keeps the selectors honest; the desktop layout is a separate sweep worth adding.
  test.use({ viewport: { width: 430, height: 932 } });

  test('onboarding steps', async ({ page }) => {
    await page.goto('/');
    await scan(page, 'welcome');

    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page.getByRole('button', { name: /continue as guest/i })).toBeVisible();
    await scan(page, 'auth step');

    await page.getByRole('button', { name: /continue as guest/i }).click();
    await expect(page.getByText(/how much asl do you know/i)).toBeVisible();
    await scan(page, 'skill step');
  });

  test('home tabs', async ({ page }) => {
    await reachHome(page);
    await scan(page, 'home / journey');

    // Unanchored: the nav buttons' accessible names include a leading emoji ("🔤Alphabets"), so an
    // anchored /^Alphabets$/ matches nothing. It also must not silently skip — an earlier version
    // of this test used `if (!count) continue`, which made a run that scanned nothing look green.
    for (const tab of ['Alphabets', 'Basics', 'Review', 'Me']) {
      const button = page.getByRole('button', { name: new RegExp(tab) }).first();
      await expect(button, `the ${tab} tab must be reachable`).toBeVisible();
      await button.click();
      await page.waitForTimeout(600);
      await scan(page, `home tab ${tab}`);
    }
  });

  test('secondary screens', async ({ page }) => {
    await reachHome(page);

    // Reached via the profile tab's "Explore" hub, not the bottom bar: BottomNav now carries only
    // Home's five learning tabs (2026-07-29 — it had grown to eight items at 375px).
    for (const name of ['Shop', 'Multiplayer', 'Settings']) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first().click();
      const button = page.getByRole('button', { name: new RegExp(`${name}$`) }).first();
      await expect(button, `${name} must be reachable from the profile hub`).toBeVisible();
      await button.click();
      await page.waitForTimeout(800);
      await scan(page, name.toLowerCase());

      // Back to Home via a reload, not history: these are screen-state transitions in a single
      // route, so goBack() leaves the app where it was. onboardingComplete is persisted, so a
      // reload lands on Home rather than replaying onboarding.
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  /**
   * One dialog, scanned open. The feedback modal from Settings rather than the sign-in modal: it is
   * reachable as a guest in two deterministic clicks, whereas the sign-in prompt moves between the
   * chrome and the Me tab depending on viewport. The sign-in modal's dialog semantics (role,
   * aria-modal, Escape) are already covered directly in smoke.spec.ts.
   */
  test('an open dialog', async ({ page }) => {
    await reachHome(page);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first().click();
    await page.getByRole('button', { name: /Settings$/ }).first().click();
    await page.getByRole('button', { name: /send feedback/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'feedback dialog');
  });
});

/**
 * The same sweep at desktop width. Worth its own block rather than a viewport parameter: above `lg`
 * the app swaps BottomNav for SideNav — different markup, different labels ("Basic Signs" not
 * "Basics", "Multiplayer" not "Duel") and screens the phone layout reaches differently. None of it
 * had ever been scanned.
 */
test.describe('accessibility (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function reachHomeDesktop(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /continue as guest/i }).click();
    await page.getByRole('button', { name: /just starting/i }).click();
    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });
  }

  test('home and the side-nav screens', async ({ page }) => {
    await reachHomeDesktop(page);
    await scan(page, 'desktop home');

    for (const name of ['Basic Signs', 'Leaderboard', 'Friends', 'Settings']) {
      const button = page.getByRole('button', { name: new RegExp(name) }).first();
      await expect(button, `${name} must be reachable from the side nav`).toBeVisible();
      await button.click();
      await page.waitForTimeout(800);
      await scan(page, `desktop ${name}`);

      await page.goto('/');
      await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
