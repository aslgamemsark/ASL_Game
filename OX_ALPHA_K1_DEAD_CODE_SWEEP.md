# OX_ALPHA_K1_DEAD_CODE_SWEEP.md

**Task:** ASL-K1 · `[REPORT]` Dead-code sweep — identify unreachable/unused exports, components, and
helpers in `web/src` with executed evidence.
**Date:** 2026-08-26 · **Branch:** `audit/round4-corrections` ·
**Method:** executed `ts-prune` over `tsconfig.app.json` (320 raw findings), then hand-triangulated
every non-barrel candidate with grep (usage inside its own module vs. cross-file imports) and
read the App wiring. REPORT ONLY — no code deleted.

---

## 1. Raw ts-prune output: 320 findings — most are false positives

Two systematic classes account for the bulk:

1. **Barrel re-exports** (`analytics/index.ts`, ~28 lines): every name is "unused" only because
   ts-prune doesn't trace re-export consumers. All are used via `@/analytics`.
2. **`(used in module)` annotations** (~200 lines): exported AND consumed internally — not dead.

The remaining **91 genuinely-unimported exports** split into three real categories:

## 2. Category A — avatar/* tool-and-lab cluster (NOT deletable)

~70 of the 91 live in `src/avatar/animation|calibration|reference|retarget|viewer`. These are
consumed by:
- `/avatarlab` dev route (`App.tsx:31`, gated `import.meta.env.DEV`);
- `src/avatar/tools/*` node scripts (authoring pipeline);
- `src/avatar/tests/*`.

They're unreferenced from *shipped game code* on purpose — tree-shaken from the production bundle
by Rollup, but alive as tooling. **Verdict: keep; do not "clean up".**

## 3. Category B — true dead code (candidates for deletion)

Verified zero references anywhere in `src/` or `e2e/` outside their own defining file:

| Item | Location | Notes |
|---|---|---|
| `InAppBrowserBanner` | `components/shared/InAppBrowserBanner.tsx` (13 lines exp., 3.0 KB file) | component never imported/rendered anywhere; its logic helper `lib/inAppBrowser.ts` IS used (by tests + presumably Settings) |
| `Card` | `components/shared/Card.tsx` | zero importers — every screen rolls its own card markup |
| `handWrist`, `frameIsComplete`, `frameFromDict`, `FINGERTIPS`, `MCPS`, `POSE_NOSE` | `engine/landmarks.ts` | helper/constants with no consumers |
| `sub2d`, `add2d`, `scale2d` | `engine/math-utils.ts` | only `diff` has 2 internal refs |
| `resultFailingRequired`, `resultGet` | `engine/verifier.ts` | unused result constructors |
| `DURATION_FAST/BASE/MODERATE`, `SPRING_*`, `TAP_SCALE_FIRM` | `motion/tokens.ts` | design tokens never imported |

Estimated removable: **~350–400 LOC across 8 files**, all verified unreferenced.

## 4. Category C — ambiguous / needs owner decision

- `engine/signs/coffee.ts`: whole file duplicates the `COFFEE` sign already defined inline in
  `engine/signs/index.ts:15`. The duplicate export is unreferenced (`index.ts` defines its own).
  Deleting the file is safe but touching sign definitions deserves owner eyes.
- `types/lesson.ts` `LessonPrompt`/`LessonState`, `types/user.ts` `Achievement`: exported types
  with no importers — cheap to remove, harmless to keep.
- `TermsModal`: referenced once in `App.tsx` — need to confirm it's rendered, not just imported
  (ts-prune flagged it; grep shows an importer so it's likely fine — excluded from candidates).

## 5. Verdict

No runaway dead code: the codebase is disciplined (the analytics barrel even has a self-audit test).
Real cleanup opportunity is small and surgical: one orphaned component (InAppBrowserBanner), one
orphaned shared component (Card), a handful of math/landmark/token helpers, and a duplicated COFFEE
sign definition. Recommended action if the owner wants it: delete Category B + coffee.ts duplicate,
then run the canonical gate. This session made **no code changes** (K-stream is report-only).

## 6. Reproduce

`npx ts-prune -p tsconfig.app.json` from `web/`; filter `(used in module)` and `index.ts` lines;
triangulate each survivor with grep before believing it.
