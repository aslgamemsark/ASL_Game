# OX_ALPHA_J3_DEPENDENCY_AUDIT.md

**Task:** ASL-J3 · `[REPORT]` Dependency audit — `npm audit` vulnerabilities, outdated packages,
license/usage sanity, unused-dep scan of `web/package.json`.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `0cefc39`) ·
**Method:** executed `npm audit`, `npm audit fix --dry-run`, `npm outdated`, and a heuristic
unused-dep scan (`web/e2e-adhoc/analyze-deps.mjs`). REPORT ONLY — no package.json/node_modules
changes made (fixes are owner decisions).

---

## 1. Vulnerabilities (npm audit): 3 total, all with non-breaking fixes available

| Package | Severity | Advisory | Fix |
|---|---|---|---|
| dompurify ≤3.4.12 | moderate | XSS via in-place hook removal (GHSA-55q2-fjhq-7xh7) | `npm audit fix` |
| fast-uri 3.0.0–3.1.4 | **high** | host confusion via backslash authority (GHSA-7p8r-x3mc-p8w7) | `npm audit fix` |
| nanoid <3.3.18 | **high** | custom generators can loop indefinitely (GHSA-2v37-7h3g-55p8) | `npm audit fix` |

All three are fixed by a non-breaking `npm audit fix`. **Recommendation: owner runs it, then the full
canonical gate** (`vitest`, Playwright suite, build). Not applied here — this session's mandate is
audit-only for J-stream.

## 2. Outdated packages: 22 of 35 direct deps have newer versions

- All are minor/patch drift within declared semver ranges (`Wanted` ≈ `Latest`) except:
  - `@mediapipe/tasks-vision`: 0.10.35 → **1.0.1 major** — pinned deliberately; MediaPipe majors can
    change model APIs. Upgrade is a project, not a chore.
  - `framer-motion`: 12.x → 13.x major — same reasoning.
  - `@types/node`: 24 → 26 major — follows Node runtime choice.
- Nothing is critically stale; routine maintenance cadence is fine.

## 3. Dependency usage sanity (heuristic string scan)

- **Legitimately "not found in src"** (config/tooling deps used outside src strings): oxlint,
  typescript, @types/*, @axe-core/playwright (imported by e2e specs), sharp + @resvg/resvg-js
  (used by `scripts/gen-icons.mjs`).
- **Zero genuinely dead dependencies found** — every direct dep traces to src, config, scripts, or
  e2e usage.

## 4. Verdict

Healthy dependency posture: no abandoned/unknown deps, all advisories patchable without breakage.
Single action item for the owner: run `npm audit fix` + canonical gates. No code changes made in
this report.
