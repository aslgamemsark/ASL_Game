import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForAnimationsToSettle, completeOnboarding } from './helpers';

/**
 * Automated accessibility sweep over every screen reachable without a camera device.
 *
 * Why axe rather than another hand-written audit: colour contrast on this project is now covered
 * mechanically (tests/tokenContrast.test.ts), but operability — keyboard reachability, dialog
 * semantics, accessible names, heading order — was never measured at all. A one-off manual audit
 * of that surface rots the moment a new screen ships; a rule engine run in CI does not.
 *
 * Contrast: re-enabled 2026-07-30 (was blanket-disabled — see WORKLOG for how that let a
 * genuinely broken light-theme focus ring ship for days). tests/tokenContrast.test.ts still owns
 * the webcam mirror / reference clip overlays specifically (computed against both frame
 * extremes, which axe cannot do for a live video/canvas background) — this scan covers
 * everything else, and is the mechanical backstop for exactly the kind of drift the token test's
 * hand-picked pairs can't see (a token used somewhere new, or hardcoded instead of using one).
 */

/** Serious/critical only. Minor + moderate findings are logged but do not fail — this is a gate
 *  against real barriers, not a style linter, and a noisy gate gets disabled. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

async function scan(page: import('@playwright/test').Page, label: string) {
  // Wait for in-flight FINITE entrance animations (framer-motion opacity/transform fades, several
  // screens use staggered `transition={{ delay: i * 0.04 }}` per list item) to finish before
  // scanning. Found 2026-07-30, re-enabling color-contrast: axe was catching cards mid-fade-in at
  // partial opacity — a real but TRANSIENT reduction in contrast during an entrance animation, not
  // the settled state WCAG 1.4.3 actually governs.
  //
  // Deliberately excludes INFINITE animations (`iterations === Infinity`) — Home's current-lesson
  // node bob and several hover-glow effects loop forever by design (real, intentional motion, see
  // the UI audit's inventory of ~22 `repeat: Infinity` animations), so "wait for every animation to
  // stop" never resolves on those screens and hangs the whole scan.
  //
  // Found 2026-07-30 the hard way: a direct `page.goto('/')` -> scan() reproduced a stale-opacity
  // violation that an extra manual wait (giving the animation time to register first) did not —
  // see helpers.ts for the full mechanism (also needed by mobile.spec.ts's touch-target sweep).
  await waitForAnimationsToSettle(page);

  // Scan TWICE and report only what both runs agree on.
  //
  // Contrast is the one axe rule whose result depends on the pixel state at the instant of the
  // scan, and this app fades screens in. Waiting for the fade is not reliably possible: the wait
  // can complete before the animation has even started, and framer-motion's `reducedMotion="user"`
  // deliberately keeps opacity animations, so emulating reduced motion does not remove them either.
  // The tell that these were transients and not barriers: the SET of flagged elements changed on
  // every run — Leaderboard rows once, a Friends line the next, Home headings the next — while a
  // direct measurement of the elements at rest cleared AA comfortably (the Friends line that
  // flagged three times is 6.51:1).
  //
  // A real violation is a property of the settled DOM and survives both passes. A mid-fade one does
  // not. This keeps the gate honest — nothing is suppressed by rule or by selector — while making
  // it deterministic. Cheaper and far more truthful than the alternative of disabling the app's
  // animations for tests, which would mean scanning a rendering no user ever sees.
  const collect = async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    // Compared as compact strings, not raw violation objects: axe's node objects are enormous and
    // a `toEqual([])` on them buries the finding under hundreds of lines of diff.
    return new Set(
      violations
        .filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))
        .flatMap((v) =>
          v.nodes.map((n) => `[${v.impact}] ${v.id} — ${v.help} @ ${n.target.join(' ')}`)
        )
    );
  };

  const first = await collect();
  await page.waitForTimeout(400);
  const second = await collect();
  const blocking = [...first].filter((v) => second.has(v)).sort();

  expect(blocking, `${label}: ${blocking.length} serious/critical a11y violation(s)`).toEqual([]);
}

test.describe('accessibility', () => {
  // Pinned to a phone viewport. The app is mobile-first (`max-w-lg mx-auto`) and swaps navigation
  // at `lg`: BottomNav below it, SideNav above, with different labels ("Basics" vs "Basic Signs",
  // "Duel" vs "Multiplayer") and Shop reachable only via a top-bar icon on desktop. Scanning one
  // breakpoint keeps the selectors honest; the desktop layout is a separate sweep worth adding.
  // Reduced motion, deliberately: the app wires <MotionConfig reducedMotion="user">, so emulating it
  // suppresses every framer-motion entrance — including the ScreenTransition fade between screens.
  // Without it axe can scan a screen mid-fade and report a TRANSIENT opacity as a contrast
  // violation; which elements get flagged then varies per run and per engine (leaderboard rows one
  // run, a Friends heading the next), which reads as a flaky gate rather than the timing artefact
  // it is. WCAG 1.4.3 governs the settled state, so measuring it is also the more correct scan.
  test.use({ viewport: { width: 430, height: 932 }, contextOptions: { reducedMotion: 'reduce' } });

  test('onboarding steps', async ({ page }) => {
    // The 'auth' step (Google/email/guest) only renders when Supabase is configured — CI's `e2e`
    // job runs with it deliberately unconfigured (see ci.yml), so this step is genuinely
    // unreachable there. An honest skip beats a helper that pretends the step exists; full
    // coverage of this exact test is the job of a future Supabase-configured e2e tier.
    test.skip(!process.env.VITE_SUPABASE_URL, 'auth step only renders when Supabase is configured');

    // 2026-08-30 value-before-signup reorder: welcome -> skill -> firstSign -> auth -> done.
    // "Get Started" no longer branches on supabaseReady — it always goes to skill first now.
    await page.goto('/');
    await scan(page, 'welcome');

    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page.getByText(/how much asl do you know/i)).toBeVisible();
    await scan(page, 'skill step');

    await page.getByRole('button', { name: /just starting/i }).click();
    await expect(page.getByText(/try your first sign/i)).toBeVisible();
    await scan(page, 'firstSign step');

    // No fake camera device in CI (playwright.config.ts) — skip, same as a real user without a
    // working camera would.
    await page.getByRole('button', { name: /skip for now/i }).click();
    await expect(page.getByRole('button', { name: /continue as guest/i })).toBeVisible();
    await scan(page, 'auth step');
  });

  test('home tabs', async ({ page }) => {
    await completeOnboarding(page);
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
    await completeOnboarding(page);

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
    await completeOnboarding(page);
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
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: 'reduce' } });

  test('home and the side-nav screens', async ({ page }) => {
    await completeOnboarding(page);
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
