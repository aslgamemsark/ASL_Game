# OX_ALPHA_E1_AXE_SWEEP.md

**Task:** ASL-E1 · `[REPORT]` Full axe sweep — accessibility-tree audit across all guest-reachable
surfaces, reporting **every** finding (the canonical a11y.spec.ts gate reports only stable
serious/critical ones; this audit shows the complete picture behind that threshold).
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `7f524e8`, clean) ·
**Method:** executed Playwright + axe-core probe (`web/e2e-adhoc/probe-axe-full.mjs`) against the
production build, phone width 390×844, reusing a11y.spec.ts's proven settle-wait + double-scan
agreement mechanics (finite animations awaited, transient findings flagged separately). No code changed.

---

## 1. Scope executed

10 surfaces scanned, double-scan each: Home/Journey, Alphabets tab, Basics tab, Review tab, Me tab,
Leaderboard, Friends, Multiplayer, Settings, and the open feedback dialog.

## 2. Results — 19 stable findings total, 0 serious/critical

| Surface | Raw | Stable | Serious+ |
|---|---:|---:|---:|
| home / journey | 2 | 2 | 0 |
| Alphabets / Basics / Review / Me tabs | 2 each | 2 each | 0 |
| leaderboard / friends / multiplayer / settings | 2 each | 2 each | 0 |
| feedback dialog | 1 | 1 | 0 |

## 3. The findings are exactly two rule families — both moderate, both known

1. **`landmark-one-main` (every page):** the document has no `<main>` landmark. The app renders its
   screen content inside generic divs (`ScreenTransition` → page components); no screen ever declares
   main. Screen-reader users can't jump-to-main.
2. **`region` (all content outside landmarks):** the flip side of the same coin — with only the nav
   landmarks present, every heading/card sits outside any named region, so axe flags it per element
   (x3 on gate pages up to x14 on Settings).

Everything else axe checks — names/roles/values, dialog semantics (aria-modal, labelledby), heading
order, image alts, keyboard reachability, focus traps, duplicate ids, ARIA attribute validity — is
clean across all 10 surfaces. That matches the canonical gate's own history (a11y.spec.ts has been
green since 2026-07-30, including this session's full-suite run).

## 4. Assessment

These two findings are **structural and app-wide, not per-screen defects**: fixing them means adding a
`<main>` wrapper in App.tsx's render tree (one place) — at which point both rules clear everywhere
simultaneously. That is an owner-visible code decision (touches the shell every screen renders inside),
so per `[REPORT]` scope it is documented here rather than patched. Severity stays moderate: no
serious/critical barriers exist for this audience beyond landmark navigation convenience, and E3
(screen-reader pass on camera screens — still pending in the master list) is the task that will weigh
how much jump-to-main matters in practice for screen-reader users.

## 5. Evidence & re-run

Probe committed: `web/e2e-adhoc/probe-axe-full.mjs`. Re-run:
`node web/e2e-adhoc/probe-axe-full.mjs` with any server on :4173 serving `dist/`. It prints per-surface
raw/stable counts and the summary table reproduced above; findings marked `*` survived both scans
(stable), unmarked ones were transients caught mid-animation in one pass only.
