# QuickSign Product Trust Implementation Audit

## Baseline — 2026-08-31

- Working branch: `codex/quicksign-product-trust`, created from `6829bda`.
- Production origin: `https://quicksignn.vercel.app`.
- `origin/main` has eight commits absent from this branch. They overlap camera preview pacing,
  adaptive recognition pacing, and recovery code; a merge would conflict in recognition, camera,
  progress, verifier, authentication, and camera pages. They are not merged or cherry-picked.
- Existing untracked recognition-outcome files and ad-hoc probes are preserved untouched. Their
  vocabulary is useful, but their quality thresholds are not yet calibrated from valid fixtures.

## Batch 0 — Release Source of Truth

- Updated canonical, Open Graph, Twitter, schema, sitemap, robots, static-page, production-test,
  and onboarding documentation URLs to `quicksignn.vercel.app`.
- Added one application `main` landmark around active screen content.
- Hid the Profile Explore cards at `md` and above. Phone navigation remains unchanged; the SideNav
  reaches Leaderboard, Friends, Multiplayer, and Settings, while the TopBar reaches Shop.
- Added focused Playwright checks for one `main` landmark and desktop navigation parity.

### Evidence

- `npm run build` passed on 2026-08-31.
- Focused Chromium Playwright checks passed: desktop Explore visibility/navigation and one main
  landmark.
- Vercel deployment-to-commit mapping remains unverified locally; see `HUMAN_ACTIONS.md`.

## Deferred Until Calibrated

- No quality threshold becomes punitive until every existing valid fixture stays scorable and the
  corresponding degraded fixture is rejected.
- No Face Landmarker/NMM quality gate is added: no current canonical sign requires NMM scoring.

## Privacy Hardening

- Default landmark-training collection is now off. The existing consent modal and Settings control
  remain the explicit opt-in path; dismissal and Escape already resolve to off.

## Persistence

- Added local migration `20260831195044_recognition_attempt_outcomes.sql` for nullable outcome,
  reason, and quality-metric columns plus legacy backfill. It has not been applied.
- Persisted scorable attempt outcomes into the migration’s `outcome` column; neutral outcomes are
  intentionally excluded from both `sign_attempts` persistence and `training_samples`.

## Recognition Outcome Contract — In Progress

- Canonical `PASS` and `NEEDS_CORRECTION` values now accompany every rule-pass/classifier-veto
  attempt and flow through the existing `sign_attempt` analytics event.
- Lesson, Practice, Story, and Speed now send skip/timeout outcomes through one
  `useRecognition.finalizeAttempt` path; unscorable outcomes are analytics-only and never persist.
- `NOT_SCORABLE` is emitted for explicit camera interruptions only. Threshold-based camera
  evidence remains disabled until raw frames are calibrated against valid/degraded fixtures.

## Camera Interruption Safety

- The recognition loop now retains a separate raw-frame window before stabilization. Stabilized
  hands may continue to help the verifier, but cannot become observed camera evidence.
- A denied, errored, stalled, or restarted solo camera finalizes the active attempt as
  `NOT_SCORABLE`; it remains analytics-only and does not update progress. Speed rounds also retain
  their combo on a neutral timeout or interruption.
- Threshold-based raw-frame quality decisions remain disabled pending fixture calibration.

## Practice Media Controls

- Reference clips now use native playback controls and provide restart, 0.5×/0.75×/1× speed,
  mirror, and enlarged-view controls with labelled 44px targets.
- Local attempt replay keeps native scrubbing and now exposes its mirror state. Recordings remain
  local-only and are discarded by the existing Continue/exit cleanup paths.

## Mode-Specific Mastery

- Legacy aggregate SRS remains intact while new attempts record receptive or expressive evidence.
- Expressive parameter evidence uses normalized score-to-threshold EMA; absent mode records remain
  unknown rather than being treated as zero.
- The four solo expressive flows now pass each required verifier parameter into that EMA for both
  successful and corrective attempts. Receptive answers still cannot write expressive parameters.
