import type { Page } from '@playwright/test';

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
  await page.waitForFunction(
    () => document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .every((a) => a.playState !== 'running'),
    { timeout: 5000 }
  ).catch(() => {}); // best-effort — an animation that never settles is a separate, real bug the caller should still catch
}
