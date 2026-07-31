# QuickSign — Production-Quality Hardening Pass — Release Report

**Branch:** `prod-quality-pass` · **Date:** 2026-07-31
**Scope:** all 7 planned phases complete, plus a fresh-eyes re-audit of the entire repository.

> **Superseded sections:** this document was first written when Phase 6 was partial. Phase 6 is now
> complete (see "Phase 6" below, rewritten), and a subsequent adversarial audit found seven further
> defects — five in the app, two in the test infrastructure — documented in the new sections at the
> end. The Ship/No-Ship assessment is in
> `docs/RELEASE_REPORT_FINAL_2026-07-31.md`.

---

## Executive summary

A three-front audit (architecture, UI/UX/accessibility, performance/build/config) found that four
prior polish passes had already handled the obvious things — code splitting, reduced-motion, dialog
focus management, a token'd color system with contrast tests, safe-area plumbing, an axe e2e gate.
What was left had a consistent shape: **quality was excellent wherever a shared primitive had been
extracted, and drifted wherever one hadn't** — plus five genuinely broken things no visual or a11y
check could have caught on its own:

1. Android's hardware Back button exited the app from anywhere, mid-lesson or mid-duel.
2. CI had been red on every recorded run for a week, across 12 unverified commits.
3. Every returning user downloaded ~1.5 MB for a disambiguation feature that was switched off
   (`GATE_ENFORCED = false`).
4. The core recognition loop re-rendered the whole page 28 times a second.
5. Not one of the app's 10 text inputs had a programmatic label, gating account creation.

All five are fixed. Six phases (0–5) shipped in full; Phase 6 (multiplayer) shipped its UI dedup
and correctly stopped short of a decision only a human should make (below). Every phase landed in a
tested, committed state — `tsc -b`, `oxlint`, `vitest run` (696 tests), the full Playwright suite
across chromium/android/ios (118 tests), and `npm run build`, all green at every commit.

---

## What shipped, by phase

### Phase 0 — Restore the safety net
CI was fixed at its actual root cause, not patched around: `npm run audit` was gating the build on
a live third-party advisory feed (any new CVE disclosure anywhere in the dependency tree turned the
build red with no code change), and the workflow installed only Chromium while `playwright.config.ts`
declared a WebKit `ios` project that had never once run in CI. Moved audit to non-blocking, installed
all three browser engines, added `tsconfig.app.json`'s `strict: true` (0 new errors — it had been
silently true in practice, just not enforced), fixed the vitest glob that had made `*.test.tsx`
uncollectable, deleted a dead root `vercel.json` that diverged from the real one, and added a
pre-push git hook running the full local verification chain.

### Phase 1 — Android/iOS: Back button and app lifecycle
`useScreenHistory` pushes one history entry per screen transition and pops the `Screen` state on
`popstate` — deliberately state-only, no URL change, so it doesn't touch SPA rewrites, the CSP, or
deep-link handling. Back also now dismisses the topmost dialog before it would otherwise unmount the
whole screen, folded into the existing `useDialogA11y` hook so all 11 dialogs get it for free.
Fixed two related leaks caught along the way: `SpeedChallengePage`'s countdown `setInterval` outliving
an early exit, and `useConfetti`'s uncancelled rAF loop.

### Phase 2 — First load and the 28 Hz core loop
Removed TF.js + weights from the critical path (the classifier was shadow-mode only — its download
cost bought nothing for a real pass/fail); deferred PostHog init past first paint (it had been the
single largest gzip item on the critical path, larger than React); stopped shipping ~8 MB of dev-only
avatar assets to production; ran remaining unoptimized images through the existing `sharp` pipeline.
At the core: `setResult`/`setHoldProgress` were deduped at the source the same way `framing` already
was, rather than papered over with `React.memo` alone (though the recognition subtree was memoized
too, and `AuthContext`'s value — consumed by 28 files — was stabilized).

### Phase 3 — Accessibility defects with users behind them
All 10 text inputs got real `<label>`s; the shared focus-visible ring was hardcoded to the dark
theme's color (2.04:1 on the light background, failing WCAG 1.4.11's 3:1) — fixed to the theme token
and contrast-checked in `tests/tokenContrast.test.ts`; axe's `color-contrast` rule was re-enabled
across every screen on all three device projects (it had been disabled, which is the actual reason
the ring bug survived four prior passes). Touch targets brought to 44px project-wide. `role="tablist"`
semantics added to all four tab bars. Missing `<h1>`s fixed.

### Phase 4 — Design system, one category per commit
Five primitives (`Button`, `ProgressBar`, `Card`, `Skeleton`, `Sheet`) plus a motion-token module (62
scattered transition literals consolidated), a named z-index scale (9 previously-ad-hoc values), and
the missing `text-2xs`/`text-3xs` type tokens (which alone accounted for 77 of the app's 128 arbitrary
Tailwind values). ~20 buttons, 12 progress bars (0 of which had `role="progressbar"` before), and 6
hand-rolled bottom sheets migrated — the sheets now correctly clear the iOS keyboard and the home
indicator, which none of them did before (`ModalShell` had always published `--kb`/`--sab`; nothing
but itself had ever read them).

### Phase 5 — States, offline, responsive
A global offline banner: `navigator.onLine` and the online/offline events had appeared **zero times**
in `src/`, in a PWA whose shell is fully precached — offline, the app loaded perfectly and then every
network feature failed as a generic, unexplained error. `SpeedChallengePage` no longer runs a full
timed round with no camera to a silent dead end. The 768–1023px tablet band (most iPads in portrait)
now gets `SideNav` instead of `BottomNav`'s content crammed into a 512px island inside an 834px bar.
Bottom-nav clearance — previously two disagreeing hardcoded guesses (`pb-24`, `pb-32`) that
under-cleared the safe-area-grown bar by 18px on exactly the home-indicator phones they existed to
protect — replaced with one CSS value derived from `BottomNav`'s own measured height and the same
`--sab` custom property the bar itself reads, so the two structurally cannot drift apart again.

### Phase 6 — Multiplayer UI dedup (state machines frozen, as decided)
The verbatim-duplicated join-code input and private/public toggle in `DuelPage`/`RoomPage` were
extracted into shared components (`RoomVisibilityToggle`, `RoomJoinByCode`), matching the pattern
already used for `RoomRulesPanel`. Touch targets fixed in the same commit (28px → 44px, 40px → 44px).

**The integration suite is built** — 20 tests, `web/e2e/multiplayer.spec.ts`. Reaching
`DuelPage`/`RoomPage` requires a signed-in user, and the main e2e suite runs against the real
production project, so this needed an infrastructure decision. Three options; the local Supabase
stack won because it is the only one that puts nothing test-shaped into production: a hosted
throwaway project costs money, needs CI credentials and is one copy-pasted URL from production, and
an e2e-only auth bypass would mean shipping a "skip authentication" branch in real code. Migrations
already lived in-repo, so `supabase/config.toml` was enough to get the real schema, real RPCs, real
RLS and real Realtime on `127.0.0.1`. The app is pointed at it purely by build-time env; the browser
tests sign in through the real form against real GoTrue.

The suite is split by where failures actually live. **Part A** drives the RPCs directly — the join
race is a `for update` row lock, so racing two browsers would test the same lock slower and less
deterministically: simultaneous joins for the last slot, idempotent duplicate join, reconnect into
an in-progress match, room destruction, leave-frees-slot, public/private search visibility,
brute-force throttle, and two RLS checks. **Part B** drives two real browser contexts with fake
media devices: create → join → both enter the match over real Realtime + WebRTC, wrong code refused,
public room via Search, double-tapped Join, background/foreground, network interruption, and a
phone-width touch-target check.

**Writing it found a real production defect**, fixed in migration `20260731120000`.
`join_multiplayer_room` treated every call as a new participant, incrementing `participant_count`
unconditionally while the member insert was `on conflict do nothing` — so count and membership could
disagree. Three user-visible consequences, all on the reconnect path multiplayer depends on most:
**reconnect was impossible** (an in-progress room told a returning member "room already started",
with no way back into a game they were still in); **a double-tapped Join burned the last slot**,
filling a 2-player duel with one human and then refusing the real opponent; and `participant_count`
drifted above the true headcount, mis-filtering public search.

The state machines themselves stay frozen, per the standing decision — this suite is the
precondition for revisiting that, not the thing that does it.

### Phase 7 — Documentation
`docs/WORKLOG.md` was appended in the same turn as every verified change (23 dated entries this
session, per `.claude/rules/worklog.md`). `docs/KNOWN_LIMITATIONS.md` had two claims this pass made
false — "not yet WCAG-audited" and "TF.js is ~1MB+ of critical-path runtime" — both corrected to
state what was actually verified and what honestly remains uncovered (real assistive-tech testing,
a desktop-breakpoint a11y sweep). `docs/PRODUCT_BACKLOG_SAAD.md` got one consolidated QS-014 entry
in the file's existing format rather than one per defect, since WORKLOG already carries per-change
mechanism detail.

---

## Investigated and correctly declined

Not everything the original audit flagged held up under direct verification — three items were
checked empirically and found not to be real:

- **TopBar's cart button "pops in after first paint."** Sampled opacity every ~60ms from the first
  interactive frame, cold start and after tab navigation both: opacity was 1 on every sample.
  `useLayoutEffect` resolves the position measurement before the browser paints, which is exactly
  why the described failure mode doesn't occur. No change made.
- **`ReplayCompare`'s phantom 4th tab bar** and **`ShopPage`/`SettingsPage`'s "missing async error
  handling"** — both pages are local-state-only; there is no async operation to add error handling
  to. (Recorded in WORKLOG parts 12–13.)

Also explicitly declined, evaluated rather than defaulted past: `noUncheckedIndexedAccess` (measured
at 549 errors — cost exceeds value), a routing library (the existing `Screen` discriminated union
needed history integration, not replacement — see Phase 1), jsdom+Testing Library (Playwright already
covers every page across three device projects), virtualizing lists (every list is already
`.limit(50)` or a fixed small set).

---

## Verification

Every commit in this pass passed, before landing: `tsc -b` (strict mode), `oxlint`, `vitest run`
(696 unit tests, 0 failures), the full Playwright suite across chromium/android/ios (118 tests, 2
intentional skips, 0 failures on the final run), and `npm run build`. Recurring iOS/WebKit flakes
under the 4-worker parallel cap (a known, documented characteristic of this project's own test config
under CPU contention) were re-run in isolation at `--workers=1` on the runs where they appeared; every
one passed clean in isolation, confirming CPU contention rather than a real regression.

**Not verified this pass — needs a human:**
- Real-device Back-button behavior on the installed Android TWA (mid-lesson, mid-duel, mid-sheet).
- Real assistive-technology sessions (VoiceOver/TalkBack/NVDA) — the axe scan and keyboard-only pass
  verify against the WCAG ruleset, not a live screen-reader.
- Recognition accuracy on a real camera after the TF.js/payload changes (I do not open the user's
  camera myself, per this project's testing protocol).

---

## Outstanding decisions for the user

1. **Multiplayer integration-test infrastructure** (Phase 6, above) — pick one of: dedicated test
   Supabase project, e2e auth bypass, or accept production test-data writes.
2. **Desktop-breakpoint accessibility sweep** — this pass audited the phone viewport only, matching
   the existing a11y suite's scope; `lg:`/`md:` desktop layouts got a Playwright a11y pass in an
   earlier session (2026-07-28) but not this one's expanded contrast/touch-target checks.
3. Real-device verification items listed above.

---

## Files touched (by area)

- **CI/config:** `.github/workflows/ci.yml`, `tsconfig.app.json`, `vitest.config.ts`, `vite.config.ts`,
  root `vercel.json` (deleted), a new pre-push hook.
- **Navigation/lifecycle:** `useScreenHistory.ts` (new), `useDialogA11y.ts`, `useBackDismiss.ts`,
  `SpeedChallengePage.tsx`, `useConfetti.ts`.
- **Performance:** `App.tsx`, `main.tsx`, `engine/classifier.ts`, `useRecognition.ts`,
  `contexts/AuthContext.tsx`, `vite.config.ts`.
- **Accessibility:** `AuthModal.tsx`, `ResetPasswordModal.tsx`, `SetUsernameModal.tsx`,
  `FriendsPage.tsx`, `DuelPage.tsx`, `RoomPage.tsx`, `index.css`, `tokenContrast.test.ts`,
  `a11y.spec.ts`, four tab-bar components, `useTabListKeyNav.ts` (new).
  `TopBar.tsx`.
- **Design system:** `components/ui/{Button,ProgressBar,Card,Skeleton,Sheet}.tsx` (new), a motion-
  token module, z-index scale, `text-2xs`/`text-3xs` tokens, ~37 migrated call sites.
- **States/offline/responsive:** `useOnlineStatus.ts` (new), `OfflineBanner.tsx` (new), `SideNav.tsx`,
  `App.tsx`, `HomePage.tsx`, `ProfileTab.tsx`, `index.css`, 14 pages migrated to `pb-nav-clear`.
- **Multiplayer:** `RoomVisibilityToggle.tsx` (new), `RoomJoinByCode.tsx` (new), `DuelPage.tsx`,
  `RoomPage.tsx`.
- **Docs:** `WORKLOG.md` (23 entries), `KNOWN_LIMITATIONS.md`, `PRODUCT_BACKLOG_SAAD.md`, this report.

Full per-change rationale (mechanism, not symptom, per `.claude/rules/fixes.md`) is in
`docs/WORKLOG.md`'s 2026-07-31 entries — this report summarizes; WORKLOG is the source of record.

---

## Addendum — fresh-eyes re-audit (2026-07-31, after all 7 phases)

The whole repository was re-audited from scratch, treating everything above as a **claim to be
verified rather than a record to be trusted**. Most claims held (listed below). Seven did not.

### Defects found and fixed

1. **Dev-only tooling shipped to production and was precached.** `AvatarLabPage` uses a
   `import.meta.env.DEV ? import(...) : Promise.resolve(...)` pattern so the bundler can drop it,
   with a comment explaining why. `CalibrationPage` — declared one line below, gated the same way at
   its render site — used a plain `lazy(() => import(...))`. Gating the *render* eliminates only the
   branch; the chunk is still emitted, and the PWA plugin precached it, so every user downloaded a
   calibration harness no production code path can reach. **Precache: 52 → 50 entries.**
2. **505 kB of unfetchable assets in the deploy.** `models/signs/` (421 kB of classifier weights,
   unreachable with `CLASSIFIER_LOAD_ENABLED = false`) and `dev/landmarks/` (84 kB of Avatar Lab
   fixtures). Phase 2's plan had called for the first and it never happened. Both now stripped.
3. **A comment describing behaviour the code no longer had.** `GATE_ENFORCED`'s block still read
   "the classifier still loads, still runs inference on every attempt" — untrue since 2026-07-30,
   and Phase 2 had explicitly listed correcting it.
4. **The MediaPipe WASM pin had no mechanism, only a request.** `capture.ts` pins the CDN WASM
   version in a string while `package.json` carries a caret range, so a routine `npm install` can
   move the JS wrapper forward and leave the WASM behind — the two halves of the recognition runtime
   disagreeing, which shows up as intermittent landmark behaviour, not a build error. Now a
   mutation-checked test (`tests/mediapipeVersion.test.ts`).
5. **A stale-response race on the Leaderboard.** All three tab fetchers wrote state after multiple
   awaits with no cancellation; the friends effect's deps include `xp`/`streak`, which change during
   ordinary play, so overlapping fetches were real and the last to arrive won rather than the most
   recent requested.

### Defects found in the test infrastructure itself

These matter more than the five above, because they mean other guarantees were less guarded than
they looked.

6. **The e2e suite had never been typechecked.** Neither `tsconfig.app.json` (only `src`) nor
   `tsconfig.node.json` (only `vite.config.ts`) included `e2e/` — so the suite guarding every other
   guarantee had zero type checking. Adding `tsconfig.e2e.json` immediately exposed a test that had
   been **passing without testing anything**: `chest.spec.ts`'s reduced-motion block passed
   `reducedMotion` as a top-level `test.use()` key, which Playwright does not declare and its
   runtime silently discards. Proved rather than assumed — a probe measured
   `matchMedia('(prefers-reduced-motion: reduce)').matches` as `false` under the old form and `true`
   via `contextOptions`. Every assertion in that block had run with motion fully **enabled**. Fixed;
   it now passes with reduced motion genuinely applied, so the product code was right all along —
   only the test was fictional.
7. **The a11y gate was non-deterministic and would have been dismissed as a known flake.** The full
   suite failed `desktop Leaderboard: 8 serious/critical color-contrast violations` on **chromium
   and webkit**, and passed on every isolated rerun — the exact signature of this project's
   documented CPU-contention flake. It was not that. The scan's quiescence check waits for
   animations but not for in-flight network work, so: navigate → nothing animating yet → the wait
   returns → Supabase rows arrive → they mount with a staggered entrance → axe scans them mid-fade
   and reports a transient. A `waitForTimeout(800)` masked it at 1 worker and not at 4. The tokens
   were verified innocent first (every failing pair computed: 6.71:1 worst case in light, 5.99:1 in
   dark — all clear AA). Fixed by waiting for `networkidle` before the animation barrier. The suite
   is now deterministic **and faster** — the desktop sweep went 23.8s → 12.6s, because networkidle
   resolves sooner than the fixed waits it replaced.

Also: the new multiplayer suite was being collected by the *main* Playwright config as well (60
extra cases across three device projects, aimed at the wrong webServer). They skipped because
`assertLocalOnly` defaults to localhost — but "harmless because a guard happens to catch it" is not
a reason to leave a suite pointed at the wrong build. Fixed with `testIgnore`.

### Claims independently verified as sound

Recorded so the next audit does not repeat the work: no secrets tracked in git (service-role keys
read from env everywhere, `.env.local` untracked); CSP, HSTS and Permissions-Policy correct and
split per-surface; the root `vercel.json` really is deleted; the pre-push hook is real and active
via `core.hooksPath`; TF.js genuinely does not load; the 28 Hz fix is real (28 Hz processing, 10 Hz
React updates, pass-detection independent of the throttle — implemented as a throttle rather than
the plan's "dedup" because `VerifyResult` carries continuous floats that would never dedup, which
is the right call and worth stating precisely); `AuthContext` is memoised; `React.memo` is on both
recognition-subtree components; the axe gate runs the **full** ruleset with nothing disabled;
`ErrorBoundary` deliberately avoids the `Button` primitive so its crash fallback cannot depend on
framer-motion, with a comment saying so; `TermsModal` is documented, tree-shaken dead code kept for
a one-line revert. Remaining bare `Loading…` strings are confined to `AdminPanel` (admin-only) and
the dev-only avatar viewers — the Phase 4e claim was about user-facing surfaces and holds as scoped.
