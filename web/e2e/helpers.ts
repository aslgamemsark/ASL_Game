import type { Page } from '@playwright/test';

/**
 * Walks guest onboarding to Home — was duplicated as `reachHome`/`reachHomeDesktop` across
 * a11y.spec.ts, mobile.spec.ts, navigation.spec.ts and tryYourself.spec.ts (2026-08-30 audit),
 * each hardcoding a click on "Continue as guest" as the second step.
 *
 * That hardcoded click is why the whole e2e suite failed here: `OnboardingFlow.tsx` only shows
 * the 'auth' step (Google/email/guest) when `supabaseReady` is true — otherwise "Get Started"
 * routes straight to the skill-level step, same as a guest who already chose. CI's `e2e` job runs
 * with Supabase deliberately unconfigured (see ci.yml's comment on that job for why setting even a
 * placeholder URL is worse, not better), so `supabaseReady` is always false there, the guest button
 * never renders, and every spec waiting on it timed out. This mirrors the app's own conditional
 * instead of assuming the step exists — the correct fix, not a workaround, since a real user with
 * Supabase unreachable would see exactly this shortened flow.
 *
 * Updated for the 2026-08-30 value-before-signup reorder: skill selection now leads to a
 * 'firstSign' step (try a real sign, camera-gated) BEFORE auth/Home, not straight to either. No
 * fake camera device exists in CI (see playwright.config.ts), so this always takes the "Skip for
 * now" escape hatch rather than attempting the camera flow — exactly what a real user without a
 * working camera would do, and the one path guaranteed available regardless of environment.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  // /app, not / — the app shell moved off the root path in the Phase A URL migration; / is now
  // the static marketing page and has none of this onboarding UI.
  await page.goto('/app');
  await page.getByRole('button', { name: /get started/i }).click();
  const guestButton = page.getByRole('button', { name: /continue as guest/i });
  if (await guestButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await guestButton.click();
  }
  await page.getByRole('button', { name: /just starting/i }).click();
  await page.getByRole('button', { name: /skip for now/i }).click();
  await page.getByRole('button', { name: /Journey/ }).first().waitFor({ state: 'visible', timeout: 15_000 });
}

/** Waits for in-flight FINITE framer-motion entrance animations (opacity/transform fades,
 *  several screens use staggered `transition={{ delay: i * 0.04 }}` per list item) to finish.
 *
 *  Needed before both scraping the DOM for stable element boxes (mobile.spec.ts's touch-target
 *  sweep) and running an a11y scan (a11y.spec.ts) — either one can otherwise catch the page
 *  mid-transition: a card at partial opacity (a transient, not the settled state WCAG 1.4.3
 *  governs), or an element handle that gets detached mid-animation, hanging `boundingBox()`.
 *
 *  Deliberately excludes INFINITE animations (`iterations === Infinity`) — Home's current-lesson
 *  node bob and several hover-glow effects loop forever by design, so "wait for every animation
 *  to stop" would never resolve on those screens.
 *
 *  The short delay first closes a real race: immediately after a navigation, framer-motion hasn't
 *  registered its entrance animation on the browser's animation timeline yet, so
 *  `document.getAnimations()` is momentarily EMPTY — `[].every(...)` is vacuously true, so the
 *  wait below would resolve before the fade-in even starts rather than after it ends. */
export async function waitForAnimationsToSettle(page: Page): Promise<void> {
  // Wait for in-flight NETWORK work first, then for animations.
  //
  // Animation-settling alone is not enough on any screen whose content arrives from Supabase
  // (Leaderboard, Friends, profiles). The ordering is: navigate -> nothing is animating yet ->
  // this helper returns -> the fetch resolves -> rows mount and start their staggered
  // `delay: i * 0.04` entrance -> the caller's axe scan catches them at partial opacity and
  // reports a contrast violation that is a transient, not the settled state.
  //
  // That is the failure mode this project's own event-ordering rule describes: a quiescence check
  // that watches one signal (the animation timeline) while something else relevant (an in-flight
  // request) is still running. It was masked by a `waitForTimeout(800)` at the call site, which is
  // enough in isolation and not enough under the 4-worker parallel load — so the desktop
  // Leaderboard scan failed on chromium AND webkit in a full run and passed on every rerun,
  // looking exactly like the CPU-contention flake it was not (found 2026-07-31).
  //
  // Best-effort: a screen that legitimately holds a long-poll open must not hang the scan, and
  // the animation wait below is still a meaningful barrier on its own.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(50);

  // Then wait for nothing to be MID-FADE.
  //
  // Emulating reduced motion is not enough on its own: framer-motion's `reducedMotion="user"`
  // suppresses transform and layout animations but deliberately KEEPS opacity fades, so a screen
  // can still be scanned at partial opacity and report a contrast violation that the settled state
  // does not have. Measured directly on the Friends guest-gate line that kept flagging:
  // #9C90B0 on #0D0A1E is 6.51:1 at rest — comfortably past AA — so every one of those findings
  // was a transient, not a real barrier.
  //
  // Keyed on INLINE opacity specifically: framer-motion writes `style="opacity: 0.34"` while
  // animating, whereas deliberate translucency (a disabled button's `opacity-50`, a `/60`
  // surface) comes from a class. Waiting for "no partial opacity anywhere" would therefore never
  // resolve on a screen that has a legitimately faded element.
  await page.waitForFunction(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[style*="opacity"]')) {
      const raw = el.style.opacity;
      if (!raw) continue;
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value) && value > 0 && value < 1) return false;
    }
    return true;
  }, { timeout: 5_000 }).catch(() => {}); // best-effort — a permanently half-faded element is its own bug
  await page.waitForFunction(
    () => document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .every((a) => a.playState !== 'running'),
    { timeout: 5000 }
  ).catch(() => {}); // best-effort — an animation that never settles is a separate, real bug the caller should still catch
}
