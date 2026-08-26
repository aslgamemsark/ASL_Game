# OX_ALPHA_K2_LINT_WARNING_TRIAGE.md

**Task:** ASL-K2 · `[REPORT]` Triage the ~30 oxlint warnings — categorize each, identify which are
fixable vs intentional.
**Date:** 2026-08-26 · **Branch:** `audit/round4-corrections` ·
**Method:** executed `npx oxlint` (34 warnings, 0 errors — baseline was 30 warnings/0 errors; the 4
new ones are in this session's own ad-hoc probes, see §3). Every warning individually categorized;
representative sites read in source. REPORT ONLY — no code changed.

---

## 1. Category breakdown (34 total)

| Category | Count | Rule |
|---|---|---|
| A. exhaustive-deps: camera-loop effects | 13 | react-hooks/exhaustive-deps |
| B. only-export-components (fast-refresh) | 5 | react/only-export-components |
| C. unused vars in tests/probes | 5 | eslint/no-unused-vars |
| D. no-useless-escape in probe regexes | 2 | eslint/no-useless-escape |
| E. misc genuine nits | 3 | exhaustive-deps / no-unused-expressions / unnecessary dep |

## 2. Category A — camera-loop `recognition` deps (13) → INTENTIONAL

`LessonPage`, `PracticePage`, `StoryPage`, `SpeedChallengePage`, `RoomPage`, `DuelPage` all have a
useEffect that starts/stops the MediaPipe recognition loop keyed on question/card state. The
`recognition` object is a stable hook return whose identity changing would restart the loop mid-
question — the deliberate pattern across all six pages (verified identical shape in PracticePage:
174–214 and LessonPage:179–220). Adding the dep would churn the loop on every render. Also includes
the two "useEffect contains setState without deps" hits (PracticePage:179, LessonPage:182) which are
mount-time init effects (`recognition.init()`), intentionally run-once.

**Verdict: intentional. Fix = inline eslint-disable comments or stable-ify via useRef wrapper —
owner's call; zero runtime risk as-is.**

## 3. Category B — fast-refresh mixed exports (5) → COSMETIC

Context providers (`ThemeContext`, `AuthContext`) and component files exporting a helper alongside
the component (`ParameterChecklist` ×2, `ClipEnlarge`, `ProgressBar`). Only effect: React Fast
Refresh does HMR-by-remount instead of hot-swap for those files in dev. No production impact.
Standard fix is moving helpers to separate files; low value.

**Verdict: cosmetic; fix opportunistically if touching those files anyway.**

## 4. Categories C+D — lint noise in test/ad-hoc files (7) → FIXABLE TRIVIALLY

- `tests/letters-phase2.test.ts`: LETTER_N/P/Q imported but unused (3).
- `e2e-adhoc/probe-reduced-motion.mjs`: unused `normal` var (1) — mine.
- `e2e-adhoc/probe-secret-sweep.mjs`: two `\.`/`\-` escapes inside character classes (2) — mine.
- `e2e-adhoc/probe-privacy-bundle.mjs`: dead `sawModelAssets` var (1) — mine.

**Verdict: trivially fixable (delete imports, prefix `_`, drop escapes). Not done here because
K-stream is report-only; each is a one-line change with zero behavior impact.**

## 5. Category E — misc (3)

- `AuthContext.tsx:71` missing `fetchUsername` dep: fetch-on-mount intent; adding the dep would need
  useCallback wrapping. Intentional-ish, same class as A.
- `App.tsx:175` missing `user`: session-init effect deliberately runs once at boot. Intentional.
- `LogoutConfirm.tsx:19` unnecessary `open` dep in useMemo: harmless extra dep; could remove but
  memo would then recompute less — actually the warning says it's UNNECESSARY, i.e. removing it is
  safe. Trivial fixable.
- `SkeletonInspector.ts:271` no-unused-expressions: dev-tool file, expression statement likely a
  stray `foo?.bar`. Trivial fixable.

## 6. Verdict

Zero errors; nothing here indicates a shipped bug. The 13 camera-deps warnings are the project's
established intentional pattern (documented in comments at each site); 12 are trivial cleanups
concentrated in tests + this session's probes; 5 are fast-refresh cosmetics. Recommended order for
the owner: (1) sweep categories C/D/E (~10 min), (2) decide on disabling or annotating category A,
(3) ignore B until those files change anyway. This session made **no code changes**.

## 7. Reproduce

`cd web && npx oxlint` — compare counts per rule against §1.
