# QuickSign — Production-Quality Hardening Pass — Release Report

**Branch:** `prod-quality-pass` · **Date:** 2026-07-31 · **Commits:** `00dfdf3`..`a36dcff` (23 commits)
**Scope:** 124 files changed, +2,805 / -820 lines (excludes the earlier mobile-parity/nav work
already on this branch before the pass started).

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

**Not shipped, and why:** the two-Playwright-context host/client integration suite the plan called
for. Reaching `DuelPage`/`RoomPage` at all requires a signed-in user, and this project's e2e suite
runs against the **real production Supabase project** with no local test stack and no e2e auth
bypass — every existing spec deliberately stays guest-only rather than write real accounts into
production. Building the suite means choosing one of: a dedicated test Supabase project, an e2e-only
auth bypass, or accepting production test-data writes on every CI run. That's an infrastructure
decision with real, lasting consequences, and it isn't mine to make silently — flagged in
`docs/WORKLOG.md` (2026-07-31, part 16) and `docs/PRODUCT_BACKLOG_SAAD.md` (QS-014) for a real
decision. The state machines themselves stay frozen either way, per the standing decision made at
the start of this pass.

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
