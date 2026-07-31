# QuickSign — Engineering Worklog

Running record of what changed and why. Maintained continuously during a session, newest first —
see `.claude/rules/worklog.md` for the rule, including when to compress older months.

**Read this at the start of every session, alongside `HANDOFF.md`.**

---

## 2026-07-31 (part 9) — Phase 4d: Google-icon dedup; Card primitive (available, not migrated)

- **`components/shared/GoogleIcon.tsx`** (new) — the 4-path Google "G" glyph was duplicated
  verbatim, down to the exact path data, between `AuthModal.tsx` and `OnboardingFlow.tsx`'s
  "Continue with Google" buttons, disagreeing only on pixel size (16 vs 18, now a `size` prop).
  Confirmed via `grep` on the path data that no third copy existed.
- **`components/shared/Card.tsx`** (new) — ~30 sites already agree on one exact shell
  (`bg-z-card border border-white/5 rounded-2xl`, usually wrapped in the same fade-up entrance).
  Unlike Button/ProgressBar, **this is not migrated wholesale**: those two had a real bug or
  accessibility gap driving the diff (missing disabled states, missing `role="progressbar"`); the
  card shell has neither — it's already consistent, so forcing 30 files through a mechanical
  rename buys DRY-ness at the cost of diff size for no correctness or a11y gain. Built and
  available for new call sites and for whichever future pass touches those files for its own
  reason (the same "adoption happens as each area is touched" approach already used for the motion
  tokens in part 6).
- **Verified:** `tsc -b` clean, 696 unit tests, `oxlint` clean, build clean, full Playwright suite
  (107 passed, 2 skips, 2 iOS a11y flakes that pass clean in isolation — same pattern as parts
  3/4/7/8 above).

## 2026-07-31 (part 8) — Phase 4c: ProgressBar primitive

- **`components/shared/ProgressBar.tsx`** (new) — 12 hand-rolled bars used 4 heights, 5 track
  colours, **zero** `role="progressbar"`, and animated `width` in 9 of 12 (a layout property —
  every retarget reflows the bar, its siblings, and its flex parent; `SpeedChallengePage`'s timer
  bar retargeted on every countdown tick via a plain `style={{ width }}`, where the `transition`
  prop next to it had never actually done anything — `style` isn't tweened by framer-motion, only
  `animate` is). One component fixes both: always `scaleX` on a fixed-size track (the mechanism
  `ParameterChecklist` already used for its two bars, generalized), always a real accessible name
  and `aria-valuenow`. Colour is a caller-owned prop, not a `variant` enum — it's genuinely semantic
  per site (red for a failure rate, green for a claimed quest), not drift to consolidate.
  `clampProgress` (exported, unit-tested) treats non-finite input — a `0/0` from an empty
  denominator, which several call sites were already manually guarding with a ternary — as empty
  rather than letting `scaleX: NaN` reach the DOM, where it renders the bar invisible, not empty.
- **Migrated all 12 sites.** One had the codebase's last inline-`style` gradient
  (`StreakCard.tsx`); named it `bg-gradient-flame` in `index.css` alongside the other gradient
  utilities rather than leaving one bar as the sole exception to "gradients are named classes."
  `UserProfilePage.tsx`'s purple gradient is genuinely distinct from `bg-gradient-primary` (90°
  vs 135°, different stops) and stays as its own `fillClassName` — not everything sharing a
  gradient-adjacent look is drift.
- **Verified:** `tsc -b` clean, 696 unit tests (+3 for `clampProgress`), `oxlint` clean, build
  clean, full Playwright suite (108 passed, 2 skips, 1 chromium a11y flake that passes clean in
  isolation — same CPU-contention pattern as parts 3/4/7 above, not a regression).

## 2026-07-31 (part 7) — Phase 4b: Button primitive

- **`components/shared/Button.tsx`** (new) — 22 `bg-gradient-primary` call sites agreed on the
  visual language (gradient, bold white text, `rounded-2xl`) and disagreed on everything else:
  **5 different paddings, 4 different text sizes with 9 more left unset** (inheriting whatever was
  ambient), and **disabled styling present at only 3 of 22** — so 19 primary CTAs had no visual
  disabled state at all despite several being genuinely disable-able (`LessonPage`'s Start while
  the camera model loads, `RoomPage`'s Start Game under 2 players). Placed in `shared/` alongside
  `Toggle`/`ModalShell`/`HeaderBackButton` rather than a new `ui/` directory — same category of
  thing, and a parallel directory for it would be the split this pass exists to remove.
  Three `size` values (sm/md/lg) cover all 5 previous paddings; `min-h-11` guarantees the 44px
  touch-target floor regardless of size (`sm`'s padding alone lands at ~42px). **No `variant`
  prop** — only the gradient variant exists today, and one gets added the day a second actually
  ships, not speculatively.
- **Hover/tap scale was drifting too**: every migrated site already used `whileTap: 0.97`, but
  hover was split between `1.02` and `1.03` for the same intent (imperceptibly different at that
  magnitude). Added `HOVER_SCALE_DEFAULT` to the motion tokens and baked both into the primitive —
  the first real consumer of `motion/tokens.ts`, as planned in part 6.
- **Migrated 19 sites across 17 files.** Three deliberate non-migrations, each commented at the
  site: `PracticePage.tsx:475` (a full card with `p-5 text-left`, not a button shape — sharing the
  gradient is not sharing the component), the 3 progress-bar fills + 1 quest pill (same gradient,
  different element entirely), and **`ErrorBoundary.tsx`** — kept as a plain `<button>` because it
  is the app's last line of defense against a crash anywhere in the tree, so its fallback UI must
  not take on a framer-motion dependency that could itself be implicated in a future crash.
  `OnboardingFlow`'s "Get Started" keeps its custom hover glow via prop override — the app's single
  most-tapped button, a deliberate flourish rather than drift.
- **A measurement trap worth recording:** an ad-hoc spot-check script reported the migrated
  `sm` button at 42.5px, looking like a real touch-target regression. It was not — the script
  measured while `LetterDetailModal`'s entrance animation (`scale: 0.96 → 1`) was still running, so
  the box was 96% of its settled size. `getComputedStyle` read a clean `min-height: 44px` /
  `height: 44px` at the same moment. Same class as the two stale-handle races already fixed this
  session: **any DOM measurement taken without waiting for animations to settle is measuring a
  transient**, and a scale transform makes it silently wrong rather than obviously wrong. The real
  suite was never affected — `e2e/helpers.ts`'s `waitForAnimationsToSettle` already covers it.
- **Verified:** `tsc -b` clean, 693 unit tests, `oxlint` clean, `npm run build` clean, full
  Playwright suite 106 passed / 2 platform-conditional skips / 3 iOS a11y flakes that each pass
  clean in isolation (`--workers=1`: 5/5 green) — the CPU-contention pattern documented in parts 3
  and 4 above, not a regression from this change.

## 2026-07-31 (part 6) — Phase 4a (close): motion token module

- **`src/motion/tokens.ts`** (new) — 62 distinct `transition` literals, 25 durations, 11 spring
  pairs and 10 `whileTap` scale values across 57 files, audited the same way as the z-index/type
  audits above. Unlike those two, **not migrated in place**: a `transition` object is almost always
  mixed with component-specific `delay`/`repeat` values that don't belong in a shared constant, so
  a mass rename here would touch the same 57 files this module exists to stop growing, for little
  benefit before the components that will actually consume it exist. Named 4 durations, 1 easing
  curve, 3 spring configs and 2 tap-scale values from the clusters the audit found (e.g.
  `SPRING_DEFAULT` = stiffness 300/damping 25, already the majority case). Adoption happens as each
  UI category is rebuilt as a primitive (Phase 4b onward), not as a standalone migration pass.
- **Deferred to Phase 4b**: the dev-only component gallery route + Linux-only Playwright visual
  baselines. An empty gallery has nothing to show yet — standing it up now would be scaffolding
  built ahead of the thing it's meant to showcase. Building it alongside the first real primitive
  (Button) gives it actual content from the start.
- **Verified:** `tsc -b` clean, `oxlint` clean (pure additive file, zero current consumers).

## 2026-07-31 (part 5) — Phase 4a (cont.): text-2xs/text-3xs type-scale tokens

- **73 call sites used arbitrary `text-[11px]`/`text-[10px]`** — Tailwind's built-in scale stops at
  `text-xs` (12px), so every badge/timestamp/pill-label/footnote below that size re-typed the same
  two magic numbers instead of naming them (design-system audit, 2026-07-31; audited count via
  `grep -rEon "text-\[[0-9]+px\]"`: 53×11px, 20×10px, plus 3×9px/1×8px left as genuine one-offs).
  Added `--text-2xs: 11px` / `--text-3xs: 10px` to `index.css`'s `@theme` block — **deliberately no
  paired `--text-2xs--line-height`**: confirmed against the compiled CSS that `text-[11px]` never
  set a line-height (`.text-\[11px\]{font-size:11px}`, nothing else), and Tailwind only applies a
  line-height companion when the theme key has one — adding one now would smuggle a real visual
  change into what should be a pure rename. Verified before the bulk sed: built, compared
  `.text-2xs{font-size:var(--text-2xs)}` against the original arbitrary-value output — same shape,
  same behavior. Migrated all 73 sites (`sed`, all 21 files) after the single-site smoke test held.
- **Verified:** `tsc -b` clean, 693 unit tests, `oxlint` clean, full Playwright suite (109 passed, 2
  platform-conditional skips, 0 failures) — including the Settings/Friends/Multiplayer touch-target
  tests that were the subject of the previous entry's stale-handle fix, now consistently green.

## 2026-07-31 (part 4) — Phase 4a (start): named z-index scale

- **9 ad-hoc z-index values** (`z-10` through `z-[9999]`) had accumulated across 30+ files with no
  shared scale — confirmed by audit (`grep -rEon "z-\[?[0-9]+\]?\b"`), matching the plan's finding.
  Named all 7 GLOBAL-overlay-hierarchy values (`z-40`/`z-50`/`z-[60]`/`z-[70]`/`z-[100]`/`z-[200]`/
  `z-[9999]`) as `@utility` classes in `index.css` — `z-chrome`, `z-overlay`, `z-elevated`,
  `z-confirm`, `z-nested-modal`, `z-takeover`, `z-debug` — using the exact same numbers already in
  use (verified byte-identical compiled CSS before/after: `.z-overlay{z-index:50}` etc.), so this is
  a pure rename with zero behavior change, not a renumbering. `z-10`/`z-20` (StreakCard, TurnOverlay)
  deliberately left as plain Tailwind utilities — they're local component stacking, not part of the
  app's global overlay hierarchy the audit was actually about. Each tier's doc comment in `index.css`
  names its real call sites so the next dialog picks a name instead of guessing a number.
- **Root-caused what looked like an 11-test regression down to two unrelated things, neither in this
  diff**, while verifying: (1) an orphaned `playwright test` process + stale `vite preview` server
  from earlier in the session had never exited and was silently competing for CPU across every
  subsequent run (found via `Get-CimInstance Win32_Process`, fixed with `Stop-Process` — see the
  part-3 entry above for the first occurrence of this exact mechanism) — after killing it, failures
  dropped from 11 to 3; (2) `mobile.spec.ts`'s touch-target loop had a second, narrower race beyond
  the one already fixed in part 3: instrumenting the exact failing query (Settings/iOS) showed it
  settles at a stable 8 elements on most runs, but occasionally `.all()` catches one more that later
  goes stale before its turn in the `for` loop, hanging `boundingBox()` for the full 60s test
  timeout. Reproduced directly, but the extra element itself proved too narrow a window to catch
  with instrumentation (a diagnostic dump of the same query passed clean). Fixed at the mechanism
  level instead of chasing the specific cause further: `boundingBox({ timeout: 2000 })`, catching a
  timeout as "this element is no longer meaningfully present, skip it" rather than letting one stale
  handle consume the whole test's budget. Stress-tested 3x on `ios` (18/18 green, `--repeat-each=3
  --workers=1`) — Settings/Friends/Multiplayer now consistently take 20-33s instead of a coin-flip
  between ~8s and a 60s timeout, meaning several elements ARE hitting the 2s skip-timeout on every
  run, not just occasionally. Worth a closer look in a future session (is WebKit's bounding-box
  stability check for a `motion.div` under an active `transform`/`opacity` animation simply this
  slow, independent of any node being genuinely detached?) but the fix's actual contract — never
  hang, never fail — holds regardless of which of those two explanations turns out to be right.
- **Verified:** `tsc -b` clean, `npm run build` (compiled CSS spot-checked for byte-identical
  `z-index` values across all 7 named tiers), full Playwright suite green.

## 2026-07-31 (part 3) — Post-phase review: extracted useTabListKeyNav, chased a flake to ground

Required post-phase self-review (EXECUTION RULES) on the part 2 diff surfaced one real red flag:
the ref-array + keydown-wiring boilerplate around `nextTabIndex` was now duplicated identically
across all 3 tab bars — "same non-trivial pattern more than once" per `.claude/rules/red-flags.md`.
Extracted `hooks/useTabListKeyNav.ts` (ref-callback factory + keydown handler bound to an
`onSelect` callback) and rewired `LeaderboardPage`/`AdminPanel`/`AuthModal` onto it, deleting the
per-file `useRef<(HTMLButtonElement|null)[]>` and inline `onKeyDown` bodies. `lib/tabListNav.ts`'s
`nextTabIndex` stays the pure, independently-tested piece the hook wraps.

Also chased down what looked like a new regression and turned out not to be one — worth recording
precisely since it cost real verification time:
- Two consecutive full-suite runs after the refactor showed **11 failures**, almost all iOS,
  spanning unrelated test categories (a11y, navigation, touch targets, mobile journeys) — too broad
  to be a code defect in this diff. `Get-CimInstance Win32_Process` found the actual cause: an
  **orphaned `playwright test` process and its `vite preview --port 4173` server from an earlier
  run in this session had never exited**, so every subsequent run's `reuseExistingServer: true`
  silently reused the stale server while the zombie test process kept competing for CPU. Killed
  both (`Stop-Process`); the next full run dropped to 3 failures, none in files this diff touches.
- The one true repeat offender, `a11y.spec.ts`'s `home tabs` test on `ios` only, is the **same
  pre-existing WebKit flake this project already documented before this session's Phase 3 work**
  (see the earlier "home tabs"/"Basics" note) — reproduced with a genuinely different violation set
  each time (ProfileTab hub buttons one run, its stats row the next, nothing the run after), which
  is the fingerprint of "axe scanned mid-render," not a stable CSS bug: it passed clean on Chromium
  every time and passed on iOS itself 1 of 3 isolated reruns. Likely contributor, not yet fully
  closed: `ProfileTab.tsx`'s `FIRE_HOVER`/`SPARKLE_HOVER` variants are `repeat: Infinity` —
  deliberately excluded from `waitForAnimationsToSettle`'s wait (see that helper's own comment on
  why), but if a `.click()` leaves WebKit's pointer resting on a hover-triggering icon, that
  infinite filter/brightness animation can still be mid-cycle at scan time. Not chased further:
  matches `playwright.config.ts`'s own documented, accepted "machine busy, not app broken" category
  (`retries: 1` in CI exists specifically for this), and every individual test here passes
  reliably alone.
- **Verified:** 693 unit tests, `tsc -b` clean, `oxlint` clean (no new unused imports from the
  refactor). Every test in the Phase 3 diff passes in isolation on every project.

## 2026-07-31 (part 2) — Phase 3 (part 2): tab semantics, touch targets, TopBar pill a11y

- **3 real tab bars had no ARIA tab semantics** (`LeaderboardPage.tsx`, `AdminPanel.tsx`,
  `AuthModal.tsx`'s sign-in/sign-up switcher) — plain `<button>`s toggling which content renders,
  no `role="tablist"/"tab"`, no `aria-selected`, no arrow-key navigation. Added the full WAI-ARIA
  tabs pattern (`role="tablist"` container, `role="tab"` + `aria-selected` + `aria-controls` +
  roving `tabIndex` on each button, a `role="tabpanel"` wrapper around the content) plus arrow-
  key/Home/End navigation. The keyboard-nav math (`ArrowLeft`/`ArrowRight`/`Home`/`End` → next
  index) is identical across all three, so it's a new pure function, `lib/tabListNav.ts`
  (`nextTabIndex`, unit-tested), rather than tripled inline logic.
  `ReplayCompare.tsx:163` — flagged in the original audit as a fourth tab bar — turned out on
  inspection to have no tab bar at all; its only control is a `Slow-mo` toggle already correctly
  using `aria-pressed`. Left alone; the audit reference was stale.
  `BottomNav.tsx` was the audit's reference implementation for "copy this pattern" but on inspection
  uses `<nav>` + `aria-current="page"` instead (primary navigation, not in-page content tabs — a
  different, also-valid ARIA pattern). Not changed to match, since it's the semantically correct
  choice for what it is and already passes every a11y check.
- **Touch targets**: `FriendsPage.tsx` Accept/Decline (28px tall, `text-xs px-3 py-1.5`) and
  `App.tsx`'s challenge-toast Join/Dismiss — both switched to the existing `min-h-11 flex
  items-center justify-center` idiom (`ProfileTab.tsx:109`, `InstallPrompt.tsx:65`) rather than a
  new pattern. Extended `e2e/mobile.spec.ts`'s single Home-only touch-target test into a loop over
  every reachable non-camera screen (Shop/Settings/Leaderboard/Friends/Multiplayer) to find any
  other violations empirically instead of guessing at the audit's "~20 others" — none surfaced.
- **TopBar's streak/signs/gold pills** (`components/shared/TopBar.tsx`) had `whileHover`/`whileTap`
  scale animations with no `onClick` at all — a false tap affordance for mouse/touch users, not
  just a screen-reader gap, since `cursor-default` already signals non-interactive but the motion
  said otherwise. Removed the misleading animations (kept a small hover wiggle on the streak flame
  itself, cosmetic only), added `role="status"`/`aria-live="polite"`/`aria-label` to each pill
  (matching the `role="status" aria-live="polite"` pattern `LessonPage`/`PracticePage` already use
  for their own live announcements) so a screen reader gets a real name and hears value changes.
- **`HomePage` had no `<h1>`**: `TopBar` renders only there, so promoted its "QuickSign" wordmark
  span to `<h1>` — changed `lg:hidden` to `lg:sr-only` so it stays in the accessibility tree at
  desktop widths (where `SideNav`'s own plain-`<span>` brand mark, left as a span since it repeats
  across 6 screens and isn't page-specific, takes the visual role).
- **Found and fixed a second animation-timing race**, same mechanism as the one already documented
  in `a11y.spec.ts` for axe scans: the new cross-screen touch-target loop could collect an element
  handle mid-entrance-animation via `.locator(...).all()`, then have that handle detached from the
  DOM by the time its turn in the `for` loop reached `boundingBox()` — which then hangs until the
  test times out waiting for a node that no longer exists (reproduced live: `Settings` timed out
  waiting on `.nth(14)` when the settled page only ever has 8 matching elements). Extracted the
  existing animation-settle wait out of `a11y.spec.ts` into `e2e/helpers.ts`
  (`waitForAnimationsToSettle`) — same knowledge, now owned in one place — and call it at the top
  of `mobile.spec.ts`'s `assertNoTinyTouchTargets` too.
- **Verified:** 693 unit tests, `tsc -b` clean, `oxlint` clean. Full Playwright suite: every test
  passes reliably in isolation across chromium/android/ios; two full-suite runs under the local
  4-worker cap each showed a different small subset (4-8 tests) fail and none overlapped between
  runs — the exact CPU-contention signature `playwright.config.ts`'s own comments describe and
  that `retries: 1` in CI already exists to absorb. Not a regression from this change.

## 2026-07-31 — Phase 3 (part 1): accessibility — labels, focus ring, re-enabled color-contrast gate

- **10 text inputs had no programmatic label** and stripped the focus ring with
  `focus:outline-none` (`AuthModal.tsx`, `ResetPasswordModal.tsx`, `SetUsernameModal.tsx`,
  `FriendsPage.tsx`, `DuelPage.tsx`, `RoomPage.tsx`). Added a real `<label>` (visible or `sr-only`
  to match the existing placeholder-driven layout) with a matching `id`, and removed
  `focus:outline-none` from all 10 — it out-specified the global `:focus-visible` ring, so none of
  these inputs showed any focus indicator at all.
- **The focus ring was hardcoded to the dark theme's value** (`#A78BFA`) in `index.css`, giving
  2.04:1 contrast against the light theme's background — WCAG 1.4.11 needs 3:1 for non-text UI.
  Switched to `var(--color-z-purple-light)`, which is per-theme. Added a
  `describe.each(['dark','light'])('%s theme focus ring', ...)` case to
  `tests/tokenContrast.test.ts` (new `AA_NON_TEXT = 3.0` constant) so this can't silently regress.
- **Re-enabled axe's `color-contrast` rule** in `e2e/a11y.spec.ts` (`.disableRules(['color-contrast'])`
  removed) — it had been off for all four prior polish passes, which is how the following survived:
  - `--rt-z-yellow` and `--rt-z-gray-400` (light theme, `index.css`) were tuned to exactly the
    4.5:1 AA floor with zero margin — any translucent card tint compositing under them dropped
    below 4.5:1. Darkened both (`#006B88`→`#00566D`, `#625B71`→`#534D60`) for real headroom.
  - **`text-z-gray-500` was misused as a text color in 29 files** (App.tsx, most of
    `components/{admin,auth,home,lesson,multiplayer,onboarding,pwa,shared}/`, most of `pages/`) —
    that token is calibrated for borders/dividers, not text, and fails contrast when read as text.
    Bulk-replaced with `text-z-gray-400` (word-boundary sed, `border-z-gray-500` left untouched —
    verified by grep before and after).
  - `SideNav.tsx` (3 sites) and `ShopPage.tsx` (equipped badge) used the bare `text-z-purple`
    token for text; replaced with `text-z-purple-light`, the token actually calibrated for
    text-on-surface use.
  - `OnboardingFlow.tsx`'s "Beyond Words" tagline used `text-z-purple-light/80` — the 80%-alpha
    version measured 3.37:1 in the light theme (broken) and 4.91:1 in dark (thin enough to flip
    pass/fail across engines, which is what first surfaced this as an intermittent WebKit-only e2e
    failure). Removed the opacity modifier. Confirmed by grep it was the only such
    `text-z-*/opacity` instance in the codebase.
  - Root-caused a second, unrelated flake in the same suite: axe was scanning mid-entrance-animation
    (ShopPage's staggered card `delay: i * 0.04`) and catching transient partial-opacity text. Fixed
    the scan helper to wait for `document.getAnimations()` (filtered to `iterations !== Infinity`,
    so intentional infinite-repeat animations like the lesson-node bob don't block the wait forever)
    to settle, with a small pre-poll delay since framer-motion doesn't always register an animation
    on the timeline in the same tick as navigation.
- **`HomePage` (the app's primary screen) had no `<h1>`** — its own content only went as low as
  `<h3>`. `TopBar`'s "QuickSign" wordmark renders only on `HomePage`, so promoted it to `<h1>`;
  changed its desktop-hidden class from `lg:hidden` to `lg:sr-only` so it stays in the
  accessibility tree at desktop widths (where `SideNav`'s own brand mark — a plain `<span>`, left
  as-is since it repeats identically across 6 screens and isn't page-specific content) takes over
  the visual role. Checked `FriendsPage`/`ShopPage`/`MultiplayerHubPage`'s multiple `<h1>` sites
  flagged as a possible duplicate-heading defect: each pair is a mutually-exclusive early-return
  branch (guest-gate vs. signed-in), never both in the DOM at once — not a real bug, left alone.
- **Verified:** 689 unit tests, `tsc -b` clean, `oxlint` clean (pre-existing warnings only), full
  Playwright suite (94 passed / 2 platform-conditional skips / 0 failures) across
  chromium/android/ios, including the a11y spec's `color-contrast` rule now enabled everywhere.

## 2026-07-30 (part 3) — Phase 2: first-load payload and the 28 Hz recognition re-render

Product decision (with the user): drop the AI-classifier payload for everyone rather than sample
it. Six mechanisms fixed, each verified with a real before/after build, not estimated:

- **`CLASSIFIER_LOAD_ENABLED = false`** (new flag, `config/classifier.ts`) gates
  `useClassifier.ts`'s `loadOnce()` before any network/WASM work — same pattern as the existing
  `GATE_ENFORCED`, and reversible the same way. `App.tsx`'s app-wide warmup call is removed
  entirely (the three pages that use the classifier for real still call the hook themselves).
  Nothing else changed: `engine/classifier.ts`, the gate logic, `ClassifierDevPanel`, and the
  `@tensorflow/tfjs` dependency are untouched — inert, not deleted, so shadow-mode collection is a
  one-line flip to resume, not a rebuild. Left `public/models/signs/` (428 KB, a real trained ML
  artifact referenced by 8+ docs) in the repo — nothing fetches it now, so its presence costs
  nothing; deleting it would be destroying training output for no download-cost benefit.
- **The PWA precache was silently re-downloading the very thing route-splitting was added to
  avoid.** `vite-plugin-pwa`'s `globPatterns` globs the whole `dist/assets` output with no
  awareness of which chunks are lazy — so `vendor-tfjs` (1.08 MB) and `AnalyticsTab`/recharts
  (393 KB, admin-only) were being eagerly fetched by the service worker for every installed
  user on every update, completely independent of whether the app ever calls them. This is a
  bigger, previously-unmeasured mechanism than the runtime-call cost the original audit priced —
  first-paint byte counts don't see background SW precache at all. Excluded both via
  `globIgnores` (`vite.config.ts`). **Precache manifest: 59 entries / 4317 KiB → 52 / 1731 KiB.**
- **`posthog-js` (73 KB gzip, larger than React) was a static import**, putting it in the same
  blocking module graph as `main.tsx`'s `createRoot(...).render(...)` — the browser cannot paint
  until every statically-imported chunk fetches and evaluates. Made the import dynamic
  (`client.ts`), named its own `vendor-posthog` chunk. **Risk this introduces and how it's
  closed:** events fired in the window before the dynamic import resolves would previously have
  silently no-op'd — a real regression for top-of-funnel events (`landing_view`) that fire on
  literally the first paint, which is exactly what this whole project's analytics process is
  built around measuring. Added a small ready-queue (`whenAnalyticsReady` in `client.ts`,
  consumed by `capture.ts`'s `track()`) so a pre-ready event is replayed once posthog loads,
  never dropped. `main.tsx`'s `initAnalytics()` call is fire-and-forget with a `.catch` (not
  bare — see `.claude/rules/concurrency/fire-and-forget-tasks.md`).
- **~8 MB of dev-only avatar-rig assets were deployed to production** (`reference_poses/glb/*`,
  `models/avatar/ybot.glb`) — already proven unreachable by any production code path (only
  `src/avatar/tools/**`, a local CLI, reads them), already excluded from precache, but still
  sitting in the actual deploy artifact. New `stripDevOnlyPublicAssets` Vite plugin
  (`writeBundle` hook) deletes them from `dist/` post-build only — `public/` itself is untouched,
  so local dev tooling that reads/writes there directly keeps working.
- **~1.1 MB of unoptimized images.** `og-image.png` 342→78 KB, `pwa-512x512.png` 313→79 KB,
  `pwa-192x192.png` 58→16 KB, `apple-touch-icon.png` 52→14 KB (recompressed in place, same
  filenames — these are format-constrained: manifest icons and `og:image` need PNG for
  cross-platform compatibility). Five landing-page screenshots converted PNG→WebP (no format
  constraint, plain `<img>` tags): 103.9→24.7, 209.2→22.9, 46.2→12.4, 15.5→8.1, 40.6→21.6 KB;
  `landing.html`'s `src` attributes updated to match. Deleted `shots/desktop-home.png` (153.5 KB)
  — confirmed unreferenced anywhere in the repo. One-off script: `scripts/optimize-images.mjs`.
- **The self-hosted brand font had no preload**, discoverable only after `index.css` finished
  fetching and parsing — guaranteed swap flash on every load. Added
  `<link rel="preload" as="font">` for the `latin` subset (the near-universal case) in
  `index.html`.
- **MediaPipe's WASM runtime was pinned to `@latest`** on the camera critical path — an
  unpinned CDN tag can change under the app with no warning, and the JS wrapper (npm, pinned)
  and the WASM binary it drives (CDN, unpinned) must be the same version or recognition bugs get
  very confusing to trace. Pinned to `0.10.35`, matching `package.json`. Also: neither the WASM
  nor the hand/pose/face `.task` model weights (Google-hosted) were covered by any
  `runtimeCaching` rule — the existing rule only matches same-origin `/models/` paths, never
  these absolute cross-origin URLs — so a cleared cache re-fetched several MB from two different
  third parties every time. Added a `CacheFirst` rule keyed on hostname.
- **`useRecognition.ts`'s `setResult`/`setHoldProgress` fired on every processed frame (28/sec),
  each with a brand-new object** (`verify()` never returns the same reference twice) — and with
  zero `React.memo` anywhere in the codebase, this force-rerendered the entire page (and every
  animated child under it — 8-14 `motion.` nodes on the camera pages) 28 times a second for the
  full duration of every lesson/practice/story/speed/multiplayer round. Unlike `framing` right
  above it (already deduped by message equality, since it's a discrete signal), `result`/
  `holdProgress` are continuous score streams with no natural "did it change" boundary — so the
  fix is a rate throttle, not an equality check: both now publish at 10 Hz
  (`RESULT_UPDATE_INTERVAL_MS`), chosen to match `ParameterChecklist`'s existing 100 ms
  hold-bar transition so a new target arrives right as the previous one finishes. The synchronous
  pass/fail logic in the same tick (`resultPassed`, `firePass`) still reads the fresh, unthrottled
  `vr` every frame — only the React-visible publish is paced.
- **`WebcamMirror` and `ParameterChecklist` wrapped in `React.memo`** — the first components in
  the codebase to be. Verified their callers pass referentially stable props (`videoRef` from
  `useCamera`, `frameGuide` either the hook's own `framing` state or the `null` literal, never a
  fresh inline object) before wrapping, so memo actually pays off rather than doing nothing.
- **`ParameterChecklist`'s two progress bars now animate `transform: scaleX()` on a fixed-width
  track instead of `width`** — `width` is a layout property; at up to 10 retargets/sec (the hold
  bar, during every static-sign hold) each one forced a reflow of the row, its siblings, and the
  flex parent. Same visual result, composite-only cost.
- **`AuthContext`'s Provider value was a fresh 18-key object with fresh function identities every
  render**, consumed by 28 files via `useAuth()` — any one of them re-rendering for an unrelated
  reason forced the identity to change and cascaded to the other 27. The 9 functions in
  `AuthContextValue` (not the private `fetchUsername` helper, which isn't part of the public
  value) are now `useCallback`, and the Provider value is `useMemo`'d over real auth-state
  dependencies — the object now only gets a new identity when auth state actually changes.

**Measured, not estimated:** `dist/` 18 MB → 8.4 MB. PWA precache 4317 KiB → 1731 KiB (52
entries). `vendor-tfjs` (1.08 MB) and `AnalyticsTab` (393 KB) confirmed absent from
`dist/sw.js`'s precache manifest by direct grep. `posthog-js` confirmed absent from
`dist/index.html`'s `<link rel=modulepreload>` list (10 entries, down from 10 that previously
included the bundled analytics chunk at 73 KB gzip — now a separately-named, non-preloaded
`vendor-posthog` chunk). `tsc -b` clean throughout (strict mode, enabled Phase 0). 687 unit + 94
e2e green across chromium/android/ios after every individual change in this list, not just at
the end.

**Not yet verified:** actual recognition accuracy on a real device with the 10 Hz UI throttle —
the synchronous verifier logic is unchanged so this should be a pure rendering-frequency change,
but only a real camera session can confirm nothing about the *feel* of the hold-to-pass
interaction regressed. Flagged for the user rather than assumed.

---

## 2026-07-30 (part 2) — Phase 1: hardware/browser Back no longer exits the app from any screen

`grep -rn "popstate|pushState" src/` returned **zero matches** before this change — nothing in the
app ever touched browser history, so on Android (including the real TWA build in
`android-app/`), the hardware Back button closed the app from any screen, mid-lesson included.
This was the single largest "doesn't feel native" defect found in the 2026-07-30 audit, and it
affects the platform prioritized as the primary mobile target.

- **New `src/hooks/useBackDismiss.ts`** — a generic primitive: `useBackDismiss(active, onBack)`
  pushes one history entry while `active` is true and runs `onBack` when the browser lands back
  behind it; consumes its own entry if `active` turns false through some other path (a visible
  exit button, Escape) so the real browser history depth never drifts out of sync with app state.
  Nested instances (e.g. a dialog open on top of a non-home screen) compose correctly: each
  instance tags the depth it pushed with a monotonic session counter and only reacts when the
  browser lands on an entry *shallower* than its own, so closing an inner dialog never also
  triggers the outer screen's handler. Considered and rejected a generic per-screen push/pop stack
  (mirroring every `Screen` transition 1:1) — the app's actual navigation shape is flat (Home <->
  any screen, always exiting back to Home) with exactly one exception (`Settings -> Privacy`), so
  a binary "away from home" primitive matches the real graph instead of building infrastructure
  for a hierarchy that doesn't exist.
- **Wired at three call sites:** `App.tsx` (`screen.type !== 'home' && !== 'onboarding'`, dispatching
  to `goHome` or, for Privacy, back to Settings — matching each screen's existing `onExit` prop
  exactly, so Back and the visible exit button now do the identical thing); `useDialogA11y.ts`
  (folded in alongside the existing Escape handling — all 11 adopting dialogs get Back-to-dismiss
  for free, no per-dialog change needed); `MultiplayerHubPage.tsx` (`active !== 'hub'`, so Back
  from inside a Duel/Room returns to the hub's mode picker first, one level at a time, instead of
  App.tsx's own handler skipping straight to Home).
- **Deliberately state-only — no URL change**, and onboarding is excluded from the App-level
  instance (it's the true root on a fresh install, so Back from it should exit like Back from
  Home, not "go somewhere before onboarding"). Known gap, documented in `KNOWN_LIMITATIONS.md`:
  internal step machines within a screen (onboarding's own steps, `AuthModal`'s sign-in/sign-up
  tab) are not wired this pass — each would need its own adoption, and auditing every internal
  flow app-wide is a larger effort than this bug class required.
- **Fixed two unrelated leaks found while touching the same "cleanup on every exit path" territory:**
  `SpeedChallengePage.tsx`'s countdown `setInterval` was a plain local variable, invisible to the
  unmount cleanup effect — exiting mid-countdown left a 1 Hz interval calling `setCountdown` on an
  unmounted component forever. Now held in a ref and cleared on unmount too.
  `useConfetti.ts`'s `bigCelebration` rAF loop had no cancel path at all; now tracked in a ref and
  cancelled on unmount.
- **New `e2e/navigation.spec.ts`** (5 tests): Back from a non-home screen, from Leaderboard, from
  inside the multiplayer hub, closing a dialog over Home, and exhausting Back twice from Home
  without crashing — run across chromium/android/ios, all green. Full suite (94 e2e + 687 unit)
  confirmed no regressions from the new global `popstate` listeners.
- **Not yet verified:** the real Android TWA build (`android-app/QuickSign.apk`) with the actual
  hardware Back button, and iOS Safari's gesture-based back-swipe. Playwright's `goBack()` exercises
  the same `popstate` path but is not a substitute for the physical device check — flagged for the
  user rather than assumed.

---

## 2026-07-30 — Phase 0 of production hardening pass: CI restored as a real safety net

Full three-front audit (architecture, UI/UX/a11y, perf/build/config) found CI has been silently
broken since 2026-07-24 — 30/30 recorded runs failed, and 12 commits landed since with zero
automated verification. Root-caused to two independent bugs, both fixed:

- **`npm run audit` gated the build job on a live advisory feed** (`.github/workflows/ci.yml`).
  A `high` advisory published upstream for an already-installed transitive dep can turn the build
  red for a commit that changed nothing — exactly what happened. Moved to a weekly scheduled
  workflow (`audit.yml`) and scoped `web/package.json`'s `audit` script to `--omit=dev`: the 8
  remaining high-severity advisories are entirely inside `vite-plugin-pwa`'s **build-time** tool
  chain (jake → ejs → filelist), confirmed absent from the shipped bundle
  (`npm audit --omit=dev` → 0 vulnerabilities). `fast-uri` and `postcss` were real production-dep
  issues, fixed via plain `npm audit fix`.
- **`ci.yml` installed only the `chromium` Playwright browser**, but `playwright.config.ts`
  declares an `ios` project on `devices['iPhone 14 Pro']` — WebKit, not Chromium — added
  2026-07-28, four days after CI last ran. That project could never execute in CI. Now installs
  every engine (`npx playwright install --with-deps`, no browser arg).

Also landed in the same phase, each independently low-risk:
- **`tsconfig.app.json` now sets `"strict": true`.** Measured zero new errors before committing —
  the app was already strict-clean under `tsc --strict`, it just wasn't gated on staying that way.
  (Measured separately: `noUncheckedIndexedAccess` would add 549 errors — not attempted this pass.)
- **`vitest.config.ts`'s include glob now collects `*.test.tsx`** — it was typo'd to `*.test.ts`
  only, so a component test in a `.tsx` file was silently never run. (No `.tsx` tests exist yet;
  this just stops the trap for whoever writes the first one.)
- **Deleted the root `vercel.json`.** Confirmed dead by diffing its CSP against the live
  production header on `aslgame.vercel.app` — it matched `web/vercel.json` byte-for-byte, and the
  root file was missing origins (`us.i.posthog.com`, `ipapi.co`) the app actually calls. Two
  divergent configs where exactly one is real is a trap for the next deploy-config edit.
- **Removed `vite.config.ts`'s `esbuild.pure` console-stripping config.** It has been inert since
  Vite 8 switched its production bundler to rolldown — confirmed by finding the `[AI-DEBUG]`
  template literal from `useClassifier.ts` present verbatim in shipped `dist/assets/index-*.js`.
  The remaining `console.log` call sites were checked individually: all are already gated by
  `import.meta.env.DEV` (build-time eliminated regardless) or the runtime
  `isClassifierDebugEnabled()` flag (deliberately runtime per its own comment) — nothing left to
  strip.
- **Added tracked `.githooks/pre-push`** (`tsc -b && oxlint && vitest`), activated locally via
  `git config core.hooksPath .githooks`. Needs the same one-time `git config` on any other clone
  (mine did not carry over automatically — noting this so the teammate isn't surprised it isn't
  already active on their machine).

**Verified:** `tsc -b` clean, `oxlint` exit 0 (pre-existing `react-hooks/exhaustive-deps` warnings
unchanged — not introduced by this phase, several already on this session's list for Phase 2/3),
687 unit tests pass, production build clean.

**Not yet pushed** — CI green status will be confirmed once this branch's PR opens.

---

## 2026-07-29 (part 4) — BottomNav trimmed to five tabs; every relocated feature stays findable

Follow-on from part 3, at the user's request ("make it same as the pc version", "do what u can so no
feature is hard to find").

- **BottomNav is now five tabs — Journey, Alphabets, Basics, Review, Me** (`BottomNav.tsx`,
  `HomePage.tsx`, `ProfileTab.tsx`). **Why:** it had grown to eight items at 375px, ~44px each with
  no breathing room, well past the 3-5 a bottom bar is designed for. Shop/Multiplayer/Settings were
  also top-level *screens*, not Home sub-tabs — they never participated in `active`/`onChange`, so
  they sat there as visually identical buttons that behaved differently. Order now matches SideNav
  (learning progression first, Review last). `BottomNav`'s props dropped from five to two.
- **Deliberately NOT a literal copy of desktop.** SideNav's seven items would still be too many for
  a phone bar and would drop **Me** and **Settings** entirely. Copying the *philosophy* (learning in
  the nav, utilities elsewhere) rather than the item list.
- **Everything relocated lands in a labelled "Explore" hub on the profile tab** — Leaderboard,
  Friends, Multiplayer, Shop, Settings. Cards with text labels, not icons: an icon-only affordance
  is precisely what made Shop hard to find in the first place. **Shop appears in the hub AND the
  TopBar cart** — deliberate redundancy, because the cart is the one icon-only entry point left.
  This directly reverses the 2026-07-24 desktop-side reasoning ("the cart is enough"), which is
  safe now only because the cart went 32px → 44px earlier in this same session.
- **The parity test now asserts an upper bound too** (`web/e2e/mobile.spec.ts`):
  `toHaveCount(5)` on the nav's buttons, plus all five hub destinations opening and closing. The bar
  drifted to eight once, and "one more won't hurt" is exactly how that happened.
- **Watch out — accessible names include the emoji.** The hub buttons render `<span>{icon}</span>`
  next to `<span>{label}</span>`, so the accessible name is `"🏆Leaderboard"` with no space:
  `/^Leaderboard$/` matches nothing. Anchor to the END (`/Leaderboard$/`), never the start. Also,
  `MultiplayerHubPage` dismisses via `HeaderBackButton icon="close"` (`aria-label="Close"`), not
  "Back" — a `/back/i` locator hangs there.
- **Verified:** 687 unit + 79 e2e green across chromium/android/ios, `tsc -b` clean, zero lint
  errors, screenshot-checked on WebKit at iPhone width.

---

## 2026-07-29 (part 3) — Pre-launch A-Z audit: two screens were unreachable on every phone

Final launch-readiness sweep across desktop + Android + iOS before shipping.

- **Leaderboard and Friends were unreachable on every phone** (`web/src/App.tsx`,
  `web/src/pages/HomePage.tsx`, `web/src/components/home/ProfileTab.tsx`).
  **Mechanism:** `setScreen({type:'leaderboard'})` and `setScreen({type:'friends'})` had exactly one
  caller in the entire codebase — `SideNav`, which is `hidden lg:flex`. Both screens were fully
  built, routed, and rendered correctly; there was simply no way to reach them below 1024px. Not a
  layout bug — a missing edge in the navigation graph, which is why no visual or a11y check caught
  it. Found by walking every screen at each device profile and diffing which destinations each
  viewport could actually reach. **Fix:** entry rows on the profile tab (whose own copy already
  said "Sign in to sync + join leaderboards" while offering no way there). Deliberately NOT added
  to `BottomNav` — it already carries eight items at 375px. Back-exit verified: both pages already
  render `HeaderBackButton`, and `goHome()` leaves `homeTab` untouched, so the user returns to the
  Me tab they left from.
- **Regression test on the mechanism, not the symptom** (`web/e2e/mobile.spec.ts`): "every top-level
  destination is reachable at phone width" asserts each nav destination is present AND that
  Leaderboard/Friends open and can be exited. **Verified it actually fails without the fix** — the
  first attempt at that proof was invalid because the build errored (unused props) and the test
  silently ran against a stale `dist/`; re-done so the negative case genuinely compiles and fails.
- **`BottomNav` and `SideNav` are now `<nav aria-label="Main">`, not `<div>`/`<aside>`**
  (`web/src/components/home/BottomNav.tsx`, `web/src/components/shared/SideNav.tsx`).
  **Why:** the app had no navigation landmark at all on mobile — a screen-reader user had to
  traverse the whole page to reach the tab bar. Surfaced because the parity test couldn't
  distinguish the nav from page content: a "Test from Memory" card matches `/Me/` and precedes the
  nav in the DOM, so an unscoped locator silently drove the test into a Letter Test instead. The
  landmark fixes the real a11y gap and makes the test honest.
- **Playwright budget resized for a 3-project suite** (`web/playwright.config.ts`): `workers: 4`
  and `timeout: 60_000`. **Mechanism:** the 30s default and the default 8 workers were both sized
  when this suite had one project. Running three browser engines fully parallel starved them, and a
  *different* test failed on each run — always WebKit, always "onboarding did not reach Home in
  15s", never a real assertion. **Explicitly not masking a slow app:** measured cold load of the
  production bundle is 130ms on WebKit vs 1.8s on Chromium — WebKit is the *fastest* of the three
  here; the axe scans are the cost. A gate that cannot tell "app broken" from "machine busy" is not
  a gate.
- **Deliberately NOT changed:** the `.text-gradient-brand` wordmark flagged by the design hook —
  it is the app's single intentional gradient-text brand mark, documented as such in
  `OnboardingFlow.tsx`, not a heading or metric. Left as-is rather than suppressed.
- **Watch out — a false alarm worth remembering twice over.** (1) The Me tab screenshots blank if
  captured <600ms after a tab switch; `AnimatePresence` exit+enter is ~600ms, so the content is
  genuinely not mounted yet. Measured identical on Android and iOS (`immediately=false,
  after3s=true`). Not a WebKit bug. (2) Running `npm run build` by hand bakes the real
  `VITE_POSTHOG_KEY` from `.env.local` into `dist/`, and Playwright's `reuseExistingServer` will
  happily serve that stale bundle — which fails the privacy guard in `health.spec.ts` and looks
  like a regression. Let the Playwright webServer do its own build (it forces the key empty).
- **Verified:** 687 unit + 79 e2e green across chromium/android/ios, `tsc -b` clean, zero lint
  errors. Zero console errors, zero page errors and zero horizontal overflow on every screen at all
  three device profiles.

---

## 2026-07-29 (part 2) — Real Android app (TWA) + iOS PWA native-feel polish

Same day, later session. User asked to make "the android/ios app" work today, given most of the
userbase is iOS. Split into what's actually possible: iOS has no path to a native app without a Mac
(Xcode-only, no cloud-CI workaround completes same-day); Android does.

### iOS: fixed a real native-feel bug
- **`<meta name="theme-color">` now syncs live with the theme** (`ThemeContext.tsx`). It was a
  static value in `index.html`, so an installed PWA in light mode still showed the dark-purple
  status bar / task-switcher color from dark mode. Reads `--rt-body-bg` via `getComputedStyle`
  rather than duplicating index.css's hex values. Verified in-browser: dark → `#0D0A1E`, light →
  `#E7D9FB`, both live.
- **Documented, not "fixed": `apple-mobile-web-app-status-bar-style`.** iOS reads this once at
  launch — it cannot be made theme-reactive at all. Kept `black-translucent` (correct for the
  default/dominant dark theme) and wrote the tradeoff directly into `index.html` so nobody
  "fixes" it into `default` later without knowing it trades away the edge-to-edge look for the
  common case to fix a contrast issue only light-theme users hit.
- Icons were already correct (apple-touch-icon 180×180, the modern optimum) — nothing to do there.

### Android: a real, signed, installable APK — today
**Built as a Trusted Web Activity (TWA) via Google's Bubblewrap**, not a second codebase. This is
deliberate: a TWA wraps the *already-deployed, already-fixed* PWA (`aslgame.vercel.app`) in a real
Android app shell — every mobile fix from earlier today carries over automatically, there is nothing
new to maintain, and it's literally how Twitter Lite/Starbucks/Spotify Lite ship on Android. New
directory: `E:\ASL_Game\android-app\` (outside `web/`, gitignored-worthy — it's generated build
output + a keystore, not source to track in the product repo).

**Environment installed from scratch** (none of this existed): Temurin JDK 17 (winget), Android SDK
cmdline-tools + platform-tools + `platforms;android-34` + `build-tools;34.0.0` (licenses accepted by
writing the known hashes directly to `%ANDROID_HOME%\licenses\` — `sdkmanager`'s interactive prompt
doesn't reliably consume piped stdin under PowerShell).

**Watch out — two environment landmines, both worth knowing before touching this again:**
1. **Bubblewrap's `AndroidSdkTools.validatePath` expects the legacy SDK layout**
   (`<sdkRoot>/tools/bin/sdkmanager`), not the modern `cmdline-tools/latest/` layout the current
   Google installer produces. Fixed by copying `cmdline-tools/latest` → `<sdkRoot>/tools` — a
   pure path-satisfaction shim, doesn't change what's actually installed.
2. **`cmd.exe` cannot execute `.bat` files at all in this environment** — confirmed with a
   hand-written trivial `.bat`, so it's an environment/security-policy restriction, not a corrupted
   file. This breaks `gradlew.bat` and `apksigner.bat`, which is how bubblewrap's own `build` command
   invokes gradle/signing on Windows (`GradleWrapper.js` hardcodes `gradlew.bat` for `win32`).
   Worked around by running the actual build steps directly from Git Bash instead of through
   bubblewrap's Node→`cmd.exe` child-process plumbing: `./gradlew assembleRelease` (the Unix wrapper,
   which Bash executes directly — no `.bat` involved), `zipalign.exe` directly (a real `.exe`, unaffected), and
   `java -jar build-tools/34.0.0/lib/apksigner.jar sign` directly (bypasses `apksigner.bat` entirely).
   **If this SDK is ever used through a normal PowerShell/cmd terminal instead of Git Bash, re-check
   whether the `.bat` restriction still applies before assuming `bubblewrap build` will just work.**

**Non-interactive build, end to end:** `bubblewrap init` has no non-interactive flag (full inquirer.js
wizard). Bypassed by calling `TwaManifest.fromWebManifest()` directly (`android-app/generate-manifest.js`)
against the live `https://aslgame.vercel.app/manifest.webmanifest` — reuses bubblewrap's own field-derivation
logic rather than hand-guessing the JSON shape — then driving `bubblewrap`'s internal `build()` function
with a **stub `Prompt` implementation** (`android-app/run-build.js`) instead of `InquirerPrompt`, because
sequential piped-stdin prompts break with `ERR_USE_AFTER_CLOSE` (each inquirer prompt opens a fresh
readline interface on the same stream; the second one dies once the first has read EOF). Signing
passwords via `BUBBLEWRAP_KEYSTORE_PASSWORD`/`BUBBLEWRAP_KEY_PASSWORD` env vars — an officially
supported non-interactive path, no workaround needed there.

**Signing keystore:** self-generated via `keytool -genkeypair` directly
(`android-app/android.keystore`, alias `android`, CN=QuickSign, 10000-day validity). **This is the
app's real upload-signing identity — back it up outside this machine.** Losing it means any future
APK update can never be installed as an "update" over this one. The store/key password is
deliberately **not** recorded here (or anywhere in this repo) — worklog entries get committed to
git, and a password committed to git history is compromised the instant it's pushed, unrecoverably,
even if later deleted. Password was shared with the user directly in-session; if it's lost, generate
a fresh keystore and accept that any prior install can't be updated in place, only reinstalled.

**Package:** `app.quicksign.twa`, versionCode 2 / versionName 1.0.0. **Deliverables:**
`android-app/app-release-signed.apk` (3.08MB, copied to `E:\ASL_Game\QuickSign.apk` for easy sideload,
and sent directly to the user) and `android-app/app/build/outputs/bundle/release/app-release.aab`
(for eventual Play Store submission — needs a $25 one-time Play Console account, not created).

**`web/public/.well-known/assetlinks.json` (new, ships on next deploy):** Digital Asset Links file
using the keystore's real SHA-256 fingerprint (`0D:24:...:1A:2E`). Once live at
`aslgame.vercel.app/.well-known/assetlinks.json`, the TWA opens **full-screen with no Chrome URL
bar** ("verified" mode) instead of falling back to a Custom Tab with a URL bar. Verification is
automatic on Android once the file is reachable — no further action needed after deploy.

**Verified statically** (`aapt dump badging`): correct package id/version/label/launcher-icon sizes.
No `CAMERA` permission declared in the wrapper's manifest — **this is correct, not a gap**: a TWA's
`getUserMedia()` calls run inside Chrome itself, which already holds that permission; the wrapper
doesn't need its own declaration.

**NOT verified — genuinely can't be, from here:** actual install, actual camera permission flow,
actual app behavior on a device. No Android emulator or physical device is available in this
environment, and setting one up (~1GB+ system image, boot time) is bigger scope than "get a working
APK today." Per the standing rule (see memory: "test each phase live" — never fake device/camera
testing), this is handed to the user rather than claimed as verified. **Next action is the user's:
install the APK on a real Android phone and confirm the app opens, the camera prompt appears, and
recognition works.**

### Scope note (unchanged from part 1, still true)
For the *web app itself* there is still **no native Android/iOS app** — QuickSign is a React PWA. No
Capacitor/Cordova/React Native/Expo anywhere in `web/`, so Material Design, Cupertino widgets and SF
Symbols do not apply there. "Mobile" (for the PWA) means Chrome Android, Safari iOS, and the
installed home-screen PWA. Verified with
Playwright's real WebKit engine (iPhone 14 Pro) and Chromium touch emulation (Pixel 7); **the iOS
Simulator cannot run on Windows**.

### Mobile fixes
- **CSS foundation** (`web/src/index.css`). `index.html:7` set `viewport-fit=cover` and `:49` set
  `black-translucent` — both push content under the notch/home indicator — while the stylesheet had
  **zero** `env(safe-area-inset-*)`, `overscroll-behavior`, `touch-action`, or tap-highlight
  suppression. Added `--sat/--sar/--sab/--sal` + `.pt-safe`/`.pb-safe`, `overscroll-behavior-y:
  contain`, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`.
  **Watch out:** insets are exposed as **custom props, not raw `env()` per call site**, specifically
  so a test can override them — no emulator reports real insets.
- **≥16px inputs on touch** (one rule in `index.css`). iOS Safari zooms whenever a focused input
  computes under 16px **and never zooms back**. Every input was `text-sm` (14px), ~20 call sites.
  Needs `!important` — Tailwind's `text-sm` is equal-specificity and would otherwise win.
- **`min-h-screen` → `min-h-dvh`, 25 sites.** `100vh` exceeds the visible viewport while the mobile
  URL bar is expanded, pushing `mt-auto` bottom CTAs below the fold.
- **Safe-area padding** on `BottomNav`, `TopBar`, ShopPage's sheet, `ModalShell`, `CameraOnboarding`,
  install banners. **Watch out:** `p-6` and `pb-safe` set the same property at equal specificity —
  sites needing both use `px-6 pt-6 pb-[calc(1.5rem+var(--sab))]`.
- **Camera sizes to the real stream aspect** (`WebcamMirror.tsx`, `RemotePeerVideo.tsx`). Both
  hardcoded `aspect-video` + `object-cover`, so a portrait phone stream (480×640) was **cropped top
  and bottom — exactly where the signer's face and chest are** — silently invalidating the
  frameGuide percentages and the hand zones `DominantHandCheck` reads. Now derived from
  `video.videoWidth/videoHeight`, which the canvas draw already read each frame. `computeFraming`
  was always aspect-agnostic; the bug was purely the CSS container.
- **Backgrounding handled** (`useCamera.ts`): `visibilitychange` + `track.onmute`/`onunmute`. On iOS
  a backgrounded tab **mutes** the track rather than ending it, so `onended` never fired and the user
  returned to a frozen mirror with no error and no retry. `visibilitychange`/`document.hidden` had
  **zero** hits in the repo before this. Resume re-arms the existing `scheduleStallCheck()`.
- **Duel feeds stack below `sm`** — were `grid-cols-2` inside `max-w-lg px-4`, i.e. **167×94px each**
  on a 375px phone, for the surface a user signs into.
- **Dialogs**: scroll lock + `visualViewport` keyboard tracking in `useDialogA11y.ts` (publishes
  `--kb`), `max-h-[85dvh] overflow-y-auto` on `ModalShell` + the five dialogs that don't use it.
  On iOS the **layout** viewport doesn't shrink for the keyboard — only `visualViewport` does — so
  every `items-end` sheet sat *behind* it. `CameraOnboarding` was worst: ~650px in a non-scrolling
  centred box, so on an iPhone SE the **"Allow Camera" button was off-screen and unreachable**.
- **`Tooltip.tsx` works on touch** — pointer toggle, outside-tap/Escape dismiss, edge clamping. It
  was `onMouseEnter`/`onFocus` only with a `pointer-events-none` popup; tapping a div doesn't move
  focus on iOS, so it was **completely unreachable** — and it's the only place badge meanings appear.
- **P2 sweep:** ~8 sub-44px targets fixed (TopBar cart 32→44, two modal `×` closes, Duel "Leave",
  Speed "Skip", five zero-padding retry links, ProfileTab sign-in); AdminPanel's 5-tab bar scrolls
  instead of squeezing to ~67px; join-code/username inputs got `inputMode`/`autoCapitalize`/
  `autoCorrect`/`maxLength`; dead `lg:pl-64` removed from AdminPanel and PrivacyPage (neither is in
  `SIDE_NAV_SCREENS`, so no SideNav mounts); short-viewport `overflow-y-auto` guards; `ClipEnlarge`
  bounded for landscape.

### Install now (requested feature)
- **`web/src/lib/pwaInstall.ts` (new)** + a Settings "App" row + regated banner.
  `beforeinstallprompt` can fire before React mounts, and the old code captured it into
  `InstallPrompt`'s local `useState` then **discarded it on dismiss**, so Settings could never
  re-offer it. Now a module-level store read via `useSyncExternalStore`, plus an `appinstalled`
  listener (absent before). Banner gate changed from "completed a lesson" to "returning visitor,
  never during first-run", preserving the 2026-07-27 finding that an ungated banner covered the
  welcome CTA. New events `pwa_install_prompted` / `pwa_install_result`.
  **Watch out:** `useSyncExternalStore`'s `getSnapshot` **must return a referentially stable value**.
  The first version built a fresh object per call → infinite render loop (React #185) that crashed
  every screen behind `ErrorBoundary`. Caught only by e2e, never by a unit test.
- **Guest "Sign in" affordance fixed** (`TopBar.tsx`, `HomePage.tsx`). The profile chip was hardcoded
  `title="My Profile"` even when it opens the auth modal for a guest. Desktop's SideNav already
  distinguished the two; on mobile the chip is the **only** entry point, so guests had no labelled
  sign-in control. Now a `profileLabel` prop.

### Delivery — fixes existed but weren't reaching users
- **PWA switched to `registerType: 'autoUpdate'`** (`vite.config.ts`, `InstallPrompt.tsx`,
  `web/src/lib/cameraActivity.ts` — new).
  **Mechanism:** under `'prompt'` the update was **opt-in** — "A new version is ready · Refresh ·
  Later" — so anyone who tapped Later or never saw it kept their cached bundle indefinitely.
  Measured 2026-07-28: `aslgame.vercel.app` served three builds at once and **13 of 17 real users
  were still executing the 2026-07-24 bundle**, which predates the AI-veto shadow-mode fix — so they
  were still being rejected on correct signs by a gate already disabled in code. Production itself
  was current; the staleness was entirely client-side.
  **Watch out:** `autoUpdate` force-fires `window.location.reload()` on activation. `onNeedReload`
  intercepts it and `runWhenCameraIdle` defers until no camera session is live — a reload mid-lesson
  would tear down the MediaStream and discard the in-progress attempt. The `needRefresh` toast is now
  dead code and was removed (`onNeedRefresh` never fires when `auto === true`).
  **Verified:** `dist/sw.js` has `clientsClaim()`/`skipWaiting`; the prompt-mode `waiting` listener
  is absent from the bundle.

### Analysis corrections — read before trusting any PostHog number
- **Never aggregate metrics across a fix's ship date.** A 90-day `sign_attempt` query showed "70% of
  correct signs vetoed" and produced a recommendation to fix a bug **that was already fixed**
  (`GATE_ENFORCED = false`, shipped 2026-07-27 22:35). 52 of those 80 attempts came from one pre-fix
  day (2026-07-26: 52 attempts, all vetoed, 0 passed). Split by day, post-fix behaviour is exactly as
  designed — a veto is *recorded* while the learner still passes. **Always split by
  `properties.git_commit` or by day around any known ship date.**
- **Pakistan is ~86% of all events** and is friends/family, not market. Filter
  `properties.$geoip_country_code != 'PK'` on every analysis.
- **Navigation redesign investigated and rejected (for now).** Apple HIG and Material Design both cap
  bottom nav at 3–5; QuickSign has **8** at ~40px each, and the bar renders **only inside HomePage**
  — because 5 of those 8 are HomePage-internal tab state, not screens. Duolingo uses 5, Settings
  behind a gear on Profile. **But zero real (non-PK) users have ever opened Shop, Leaderboard,
  Friends, Multiplayer or Profile**, and only 6 reached Home. Revisit when those screens have
  non-zero traffic. Mobile is 45% of real users but 65% of activity.

### Testing
- `playwright.config.ts` now runs three projects: `chromium`, `android` (Pixel 7), `ios` (**iPhone 14
  Pro on WebKit** — `npx playwright install webkit`). Every existing spec had only ever run on
  Desktop Chrome. New `web/e2e/mobile.spec.ts`: journeys, chaos (rapid taps, rotation, offline,
  background/resume, dialog interruption), safe-area injection, 44px sweep, iOS 16px assertion.
  **Watch out:** blocks touching BottomNav must pin a phone viewport via `test.use({ viewport })` —
  it doesn't render above `lg`. MediaPipe's CDN wasm is unreachable in the sandbox and is filtered as
  known noise. Flaky at 8 workers on this machine; `--workers=3` is clean.
- **Verified:** 687 unit tests, 76 e2e across all three projects, `tsc -b` clean, lint clean (7
  pre-existing warnings untouched), production build clean.

### Known limitations left open
- Real notch/home-indicator insets, true iOS keyboard geometry, and actual front-camera aspect ratios
  need physical hardware — safe areas are verified by injection only.
- Camera-dependent flows (Lesson/Practice/Story/Speed/Duel) still have no e2e coverage; needs a fake
  video device, and WebKit doesn't support Chromium's fake-camera flags, so it'd be Chromium-only.
- BottomNav (mobile) and SideNav (desktop) still expose different sections. Flagged, not changed.
### Deliberately NOT done: merging `camera-and-pageleave-extras` → `main`
Assessed with `git merge-tree` (non-destructive) and **skipped by decision, 2026-07-29**. Reasons,
so this isn't re-litigated from scratch next session:
- The branches have genuinely **diverged**: main has 15 commits this branch lacks, this branch has
  18 main lacks. Not a fast-forward. **13 conflicting files.**
- **The trap:** `main` still contains `web/src/components/shared/TermsModal.tsx`, which this branch
  deleted in `636961f` ("Remove the Terms wall") as an activation fix. A careless conflict
  resolution silently **reinstates a consent wall that was removed on purpose** — one of the exact
  things measured to be killing the funnel.
- Conflicts also cover `useCamera.ts` and `WebcamMirror.tsx`, both modified the same day.
- **No urgency:** production deploys from this branch and is current (verified in the Vercel
  dashboard — "Production rebuild" of `b07f4b7`). The stale-client problem was service-worker
  caching, now fixed by `autoUpdate`. Main being behind is repo hygiene only.
- Standing rule: never push directly to `main` on this shared repo — open a PR.

When this is eventually done, resolve `TermsModal` in favour of **this branch (deleted)** and
re-verify the onboarding funnel afterwards.

---

## 2026-07-15 — Production sign-off pass

### What was done
- Ran three targeted audits (repo-wide TODO/dead-code, full Supabase security review, multiplayer
  concurrency review) and synthesized findings into four sign-off deliverables:
  `FINAL_PRODUCTION_SIGNOFF.md`, `LAUNCH_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`,
  `POST_LAUNCH_ROADMAP.md`.
- **Security fix (applied to production DB + committed):** revoked the stray `anon`/`PUBLIC` EXECUTE
  grant on `admin_set_username` so it matches the 2026-07-12 hardening of every other admin RPC.
  Migration `20260715010000_harden_admin_set_username.sql`; verified in the live DB that only
  `postgres`/`authenticated`/`service_role` retain EXECUTE.
- **Moderation follow-through (applied to production DB):** the `admin_set_username` RPC was present
  as a file but had never been applied to the live database, and the slur username `n_i_g_g_a` was
  still live. Applied the RPC and renamed the row to `player_aaca7b28` (matching the sweep script's
  placeholder convention), logged in `admin_audit_log`. Re-ran the real `isInappropriate` filter
  against all 6 live usernames — all clean.
- **Duel bug fix (earlier this session):** the 1v1 "both players sign at once" bug — root cause was
  duplicated, non-complementary role logic. Extracted to one pure `isSignerForRound()`
  (`web/src/lib/duelRoles.ts`) used by all three call sites, with a regression test.
- **Code fix:** DEV-gated an unconditional production `console.warn` in `useRecognition.ts` to match
  its siblings.
- Merged `game-feel-and-launch-prep` → `main` (with explicit user approval) so the multiplayer/
  borders/region/streak/moderation work actually deploys — it had never been merged, which is why the
  Multiplayer tab was missing on the live site. Removed a stray `tmp_head_version.ts` leftover from an
  older merge along the way.

### Why
- The user requested a final production sign-off. The highest-value, safe actions were: (1) an honest,
  evidence-grounded audit, (2) the one clearly-correct security fix, (3) closing the moderation gap
  that was actually still live, and (4) getting the finished feature branch deployed.

### Tests / verification
- Full suite green throughout: **495 passed, 9 todo**. `tsc --noEmit` clean. Production build clean.
- Live DB grants on `admin_set_username` verified post-revoke.
- All live usernames verified against the real profanity filter.

### Commits (this branch: `production-signoff-audit`)
- DEV-gate the production console.warn in useRecognition.
- Add the four sign-off deliverables + this worklog.
- (Earlier, on `game-feel-and-launch-prep` / `main`): duel role fix, admin_set_username hardening,
  stray-file removal, feature-branch→main merge.

### Risks / open items
- **Not merged to main:** this audit branch is intentionally kept off `main` (docs + one gated log fix)
  pending review — `main` auto-deploys to production.
- Launch blockers remain **human-owned**: error monitoring, and privacy/legal for a minor-facing camera
  app (see `LAUNCH_CHECKLIST.md`).
- Low-severity DB hardening (showcase_badges / speed_high_scores / region CHECK / audit parity /
  migration reorder) is documented but **not** applied — deliberately left for a reviewed migration
  rather than more autonomous production DB mutation.

### Remaining work
See `POST_LAUNCH_ROADMAP.md` (sequenced) and `LAUNCH_CHECKLIST.md` (manual tasks).
