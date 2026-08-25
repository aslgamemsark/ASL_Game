# OX_ALPHA_D5_MOTION_REDUCED_MOTION.md

**Task:** ASL-D5 · `[REPORT]` Motion & game feel, `prefers-reduced-motion` — inventory of ambient/infinite
animations, executed verification that reduced-motion users get a still-but-complete UI, and game-feel notes.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `31add21`, clean) ·
**Method:** static enumeration (`repeat: Infinity` ×22 across 11 files; CSS keyframes; Tailwind animate-*)
plus an EXECUTED Playwright probe against the production build with `reducedMotion: 'reduce'` vs
`'no-preference'` contexts (probe scripts under `web/e2e-adhoc/probe-reduced-motion.mjs`,
`probe-identify-anim.mjs`). No code changed.

---

## 1. Architecture of motion suppression (verified, not assumed)

Three cooperating layers:

1. **framer-motion global**: `<MotionConfig reducedMotion="user">` (main.tsx:33). Per framer semantics:
   transform/layout keyframe animations are **skipped** for such users; opacity fades are kept.
2. **CSS kill-switch**: `@media (prefers-reduced-motion: reduce)` zeroes animation/transition durations and
   forces one iteration (index.css:442–448). Explicitly written to cover the non-framer remainder — the
   `qs-border-*` shop cosmetics (index.css:477–500) and Tailwind's `animate-pulse`.
3. **Component-level explicit checks** where a flourish gates real UI: ChestIcon uses
   `useReducedMotion()` so the reward reveal is instant rather than after an unskippable bounce
   (ChestIcon.tsx:25–39); Zippy suppresses its idle float/bob the same way (Zippy.tsx:29,47).

## 2. Executed results (production build + preview)

| Check | reduce | no-preference |
|---|---|---|
| Running CSS animations, Home (6 samples) | **0** | 0 |
| Running CSS animations, Me tab (6 samples) | 6 — single element | 6 — same |
| BottomNav Journey icon transform while hovered (infinite rotate loop) | **frozen** (none/none) | animating (matrix changes between samples) |
| Injected `animate-pulse` skeleton | not running (killed by CSS block) | running |
| Injected `qs-border-aurora` ring | not running | running |
| ProfileTab "today" ring (framer scale+opacity infinite pulse, ProfileTab.tsx:384–387) | runs at identical opacity midpoints (~0.772 both modes) | runs |

## 3. Findings

**F1 — the only reduced-motion leak found is opacity-only, minor.** ProfileTab's "today" calendar-cell
ring (ProfileTab.tsx:384–387) animates `scale:[1,1.6,1]` AND `opacity:[0.8,0,0.8]` infinitely.
`MotionConfig reducedMotion="user"` skips the scale half but keeps opacity, so under reduce a faint
purple ring still breathes on the Me tab forever. It contains no motion/parallax — WCAG's vestibular
concern is about movement, so this is cosmetic-consistency, not an a11y violation. Fix shape if desired:
gate the whole `<motion.div>` on `useReducedMotion()` exactly as ChestIcon/Zippy already do (the codebase's
own established pattern). NOT changed here — report-only task.

**F2 — everything else verified clean under reduce.** All 22 framer `repeat: Infinity` sites were
classified: transform-based loops (BottomNav icon hovers :29–33, LessonNode idle bob :37/:90,
StreakCard flame :35/:64, TopBar fire :21, Zippy float :95–101, PracticeTab hover loops :185/:224,
ProfileTab FIRE_HOVER/SPARKLE_HOVER :16–18, HomePage speed-card wiggle :164) are skipped by
MotionConfig for reduced-motion users — empirically confirmed via the frozen-transform check above.
The DuelPage waiting-state glyphs (:681 spinning gear = rotate; :760 pulsing radar = opacity) follow the
same rule: gear freezes, radar keeps its opacity fade — appropriate, since those communicate "still working"
and opacity pulsing is the accepted reduced-motion idiom.

**F3 — CSS side has zero leaks.** The index.css kill-switch demonstrably stops both custom keyframes
(`qs-border-*`) and Tailwind `animate-pulse` under reduce (verified by injected-element probe; control run
without reduce shows both "running"). The three `animate-pulse` uses in-app (Skeleton.tsx:18,
LessonPage.tsx:341, StoryPage.tsx:226) are loading indicators — opacity pulses, correct to keep.

## 4. Game-feel notes (positive)

Tap/hover feedback is consistent where it matters most: every nav surface scales on tap
(BottomNav :66, LessonNode :70/:151, OnboardingFlow options :158/:168), primary cards have hover lift +
glow, and reward moments (chest open, level-up/badge CelebrationHost) use bounded pulses — the codebase
explicitly bans unbounded celebration loops per PRODUCT.md ("celebrate deliberately", comment at
DailyQuestsCard.tsx:94–97). Ambient idle motion (Zippy bob, current-node bob, streak flame) draws the eye
to actionable/relevant elements rather than decorating at random.

## 5. Verdict

Reduced-motion support is genuinely implemented in depth (three layers, two of them verified live) —
not just a global flag. One minor opacity-only leak (F1) is the complete list of gaps. No code change;
F1's fix shape is documented for the owner.

## Evidence

Probe transcripts inline above; scripts left in `web/e2e-adhoc/` (gitignored location used by prior
probes) for re-running: `node e2e-adhoc/probe-reduced-motion.mjs` (exit 0 = no running CSS animations
under reduce; note it counts the F1 opacity ring as a "running Animation" — see F1 for why that survives).
