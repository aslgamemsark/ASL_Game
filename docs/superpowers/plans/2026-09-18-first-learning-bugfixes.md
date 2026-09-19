# First-learning bug fixes

**Goal:** Repair the confirmed recovery and completion defects without changing signing demonstrations or recognition thresholds.

**Scope:** User approved bug fixes after the diagnostic audit. This first batch covers onboarding/Practice model recovery, onboarding first-success reporting, and lesson completion after pass/skip. The broader identity, attribution, prompt-outcome and camera-liveness work remains separate.

**Workspace:** Existing isolated production checkout, branch `codex/quicksign-first-learning-bugfixes`, baseline `50850b7`. Root checkout WIP must remain untouched. No remote push or deployment in this batch.

## Tasks

- [x] Reproduce missing model error/retry in onboarding and missing model retry in Practice using the real components and recognition hook, substituting the external MediaPipe dependency in browser tests. Retry must produce processed camera frames after a simulated initial failure.
- [x] Show model loading/failure in onboarding; retry initializes recognition and reacquires the camera. Reset its loop guard when camera fails so retry starts a fresh loop. Practice retry must initialize recognition as Lesson already does. Preserve skip and camera privacy controls.
- [x] Route onboarding's recognition attempts through `useAttemptLog`, adding an analytics-only `onboarding` source. Preserve the legacy onboarding event and shared browser deduplication. Add source/schema information to distinguish new first-success semantics. Assert one first-success event on pass and none on skip.
- [x] Route final lesson skip through the same completion function as final pass; guard duplicate completion and read current earned XP at delayed completion. Assert final-skip and final-pass paths each record the correct XP exactly once. Parent implemented all files; independent reviewer checked the diff.
- [x] Run the focused browser regression RED then GREEN, relevant existing unit tests, type/build checks, and review the full diff independently. Do not infer real ASL accuracy from mocked browser landmarks.

**Existing boundaries:** `useCamera`, `useRecognition.init/startLoop/stopLoop`, `useAttemptLog.recordAttempt`, `trackFirstSignSuccess`, `LessonPage.finishLesson`. Reuse these; no new production framework or content pipeline.

**Historical scope:** Identity and attribution were subsequently handled in the [September 19 plan](2026-09-19-analytics-cleanup-release.md), which supersedes this plan's delivery/version notes below. Animation replacement, educator outreach, thresholds and background-camera liveness remain separate work.

## Verification and delivery

- Initial browser regressions reproduced five defects; the skip-without-success case already passed.
- Review found a related existing final-skip loop leak. The real recognition loop kept processing after completion (47 to 55 model calls over 300 ms). Skip now stops the loop before clearing its guard; its regression passes.
- `npm run test:first-learning`: 7 passed. Includes recovery after an already-active camera track ends, legacy/shared onboarding event deduplication, correct final-pass/final-skip XP, and recognition cleanup. MediaPipe inference and telemetry are substituted; completion-event tests inject a pass at the recognition boundary.
- `npm test`: 62 files passed; 768 tests passed, 9 expected failures, 10 TODOs.
- `npx playwright test e2e/smoke.spec.ts --project=chromium --workers=1`: production build succeeded and 3 smoke tests passed. Existing large-bundle and mixed PrivacyPage import warnings remain.
- Focused lint: no errors; hook dependency warnings remain. `git diff --check` passed.
- Changes remain local on `codex/quicksign-first-learning-bugfixes`; no remote push or deployment. Production analytics retain their old behavior until release. Compare future first-success events using `flow_version: 2`; this does not backfill historical onboarding passes or change browser-level deduplication into account-level identity.
