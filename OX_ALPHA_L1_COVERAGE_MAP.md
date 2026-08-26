# OX_ALPHA_L1_COVERAGE_MAP.md

**Task:** ASL-L1 · `[REPORT]` Coverage map — run vitest coverage, map untested modules/branches,
rank the gaps by risk.
**Date:** 2026-08-26 · **Branch:** `audit/round4-corrections` ·
**Method:** executed `npx vitest run --coverage` (v8 provider, installed ad-hoc via
`npm install --no-save @vitest/coverage-v8` — NOT persisted to package.json). Full suite ran green.
No code changed.

---

## 1. Overall numbers (executed)

| Metric | Coverage |
|---|---|
| Statements | **67.96%** (2521/3709) |
| Branches | **52.8%** (932/1765) |
| Functions | **60.86%** (339/557) |
| Lines | **70.71%** (2282/3227) |

## 2. Highest-risk untested modules (ranked by shipped-risk × size)

| Rank | Module | Lines cov. | Why it matters |
|---|---|---|---|
| 1 | `hooks/useRecognition.ts` | **7.1%** | THE core recognition pipeline — camera→MediaPipe→verifier→attempt log. Every lesson runs through it; only its pure helpers are unit-tested. |
| 2 | `hooks/useProgressSync.ts` | **10.6%** | Cloud progress merge/conflict logic — data-loss class bugs live here (guest→auth merge). |
| 3 | `contexts/AuthContext.tsx` | **0.89%** | Sign-in/up, session restore, username fetch, training-consent gate — auth regressions lock users out entirely. |
| 4 | `engine/capture.ts` | **3.84%** | MediaPipe init + landmark extraction + camera activity gating. |
| 5 | `hooks/useAttemptLog.ts` | **14.3%** | Attempt history feeding SM-2 scheduling (partially covered via attemptLog tests). |
| 6 | `lib/geolocation.ts` | **17.6%** | Country derivation for analytics groups; low blast radius. |
| 7 | `stores/useSettingsStore.ts` | **22.2%** | Small; theme/sound toggles. |
| 8 | `data/lessons.ts` (226–240) | 22% tail | Only the daily-quest generation tail uncovered; core lesson data is exercised by H3/H6 analyzers. |

Also notable: the whole `src/analytics` directory sits at ~30% — acceptable because its capture
surface is deliberately thin and was runtime-verified in ASL-J4's live probe.

## 3. What IS well covered (context)

Engine rules (`verifier`, `gate`, `coachingGate`, `handshape`), store logic paths touched by unit
tests (`useUserStore` at ~43% with purchase/chest/streak branches), and all pure data transforms —
the project's stated testing philosophy ("pure core heavily tested, React shell thin") holds up in
the numbers.

## 4. Recommended order for L2 (fill top 3 gaps)

1. `useProgressSync` conflict/merge branches — highest data-risk per test written.
2. `AuthContext` session-restore + consent-gate branches — highest user-lockout risk.
3. `useRecognition` state machine (init/start/stop/recover transitions) — largest surface, best
   attacked via extracted pure reducers rather than mocking MediaPipe.

## 5. Reproduce

```
cd web && npm install --no-save @vitest/coverage-v8 && npx vitest run --coverage
```
(~2 min; suite green both runs.)
