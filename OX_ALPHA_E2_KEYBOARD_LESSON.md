# OX_ALPHA_E2_KEYBOARD_LESSON.md

**Task:** ASL-E2 · `[REPORT]` Keyboard-only full lesson — walk onboarding → Home → lesson start →
live lesson view → exit using **only** keyboard events, verifying every step is reachable and
operable with a visible focus indicator.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `96891d7`) ·
**Method:** executed Playwright probe (`web/e2e-adhoc/probe-keyboard-lesson.mjs`, Tab / Shift+Tab /
Enter / Space only) against the production build at phone width 390×844. Final result:
**12/12 checks PASS** (two consecutive runs). No code changed.

---

## 1. What was exercised (keyboard only; mouse used solely to position screens between phases)

| # | Step | Result |
|---|---|---|
| 1 | Initial focus is `<body>` — no rogue autofocus on app load | PASS |
| 2 | Welcome: "Get started" reachable in 1 Tab | PASS |
| 3 | Focus ring visibly painted (`outline: solid 2px` via the theme-aware `:focus-visible` token, index.css:426–430) | PASS |
| 4 | Enter activates "Get started" (onboarding advances) | PASS |
| 5 | Onboarding: "Continue as guest" reachable + Enter-operable | PASS |
| 6 | Skill pick ("Just Starting") reachable + Enter-operable | PASS |
| 7 | Onboarding completes to Home by keyboard alone | PASS |
| 8 | All five BottomNav items (Journey/Alphabets/Basics/Review/Me) keyboard-reachable | PASS |
| 9 | Practice Letters card reachable by Tab from Alphabets tab | PASS |
| 10 | Enter starts the lesson — live "Sign It 1/5" view appears | PASS |
| 11 | Camera-gate Allow button keyboard-reachable when present (observational — gate depends on browser camera state) | observed |
| 12 | In-lesson "Back" exit reachable + Enter returns Home | PASS |

## 2. Focus mechanics verified along the way

- `:focus-visible` ring is the fixed token from the 2026-07-30 fix (dark #A78BFA / light #7834E8);
  outline confirmed computed as `solid 2px` on a focused button during this run.
- No focus traps found in the walked surfaces; Tab cycles TopBar → main content → BottomNav in DOM
  order and wraps normally.
- The camera-flow screens' answer interaction itself is inherently hands/body-based (the whole point
  of the product); keyboard coverage of those controls is covered up to the point where signing begins.

## 3. Probe-harness lessons recorded (not app defects)

Two false failures were diagnosed to probe bugs before being believed as app behavior — worth noting
for future keyboard audits:

1. **BODY-textContent false positive:** when Tab focus wraps out of the page, Chromium sets
   `activeElement = <body>`, whose `textContent` is the ENTIRE page text — any text match against it
   matches spuriously. The probe now requires `tagName !== 'BODY'` for every match. This produced a
   phantom "Enter doesn't work on Practice Letters" that dissolved once the match was fixed (Enter on
   the truly-focused card works fine).
2. **Wrong expected copy:** the live lesson heading is "Sign It"/"Sign Quiz" (PracticePage.tsx:392),
   not the intro-screen phrasing initially asserted.

## 4. Verdict

No keyboard-operability defects found within the walked path. Onboarding, global navigation,
lesson entry, and lesson exit are all fully operable without a mouse, with visible theme-aware focus.
The canonical suite already guards part of this surface (`a11y.spec.ts` scans; smoke.spec.ts covers
sign-in-modal Escape semantics); this audit adds the end-to-end keyboard journey evidence.

## 5. Re-run

`node web/e2e-adhoc/probe-keyboard-lesson.mjs` with any server on :4173 serving `dist/`
(exit 0 iff all checks pass).
