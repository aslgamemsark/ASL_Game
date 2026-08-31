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

- `npm test -- --run` passed: 780 tests, 9 documented TODOs.
- `npm run build` passed on 2026-09-01.
- `npm run lint` completed with existing warnings only; no errors or new warning category.
- `npm audit --omit=dev` is clean after lockfile-only updates for transitive DOMPurify and nanoid
  advisories.
- `npm run test:multiplayer` starts its isolated local configuration cleanly; its 27 cases skip
  because the required local Supabase stack is not running.
- Focused Chromium Playwright checks passed: desktop Explore visibility/navigation and one main
  landmark.
- Vercel deployment-to-commit mapping remains unverified locally; see `HUMAN_ACTIONS.md`.

## Deferred Until Calibrated

- No quality threshold becomes punitive until every existing valid fixture stays scorable and the
  corresponding degraded fixture is rejected.
- No Face Landmarker/NMM quality gate is added: no current canonical sign requires NMM scoring.
- Replay of the 31 existing `*_correct.json` fixtures found that valid HELP, HOSPITAL, MEDICINE,
  and WRITE recordings can have incomplete raw-hand coverage. A universal `Sign.twoHanded`
  coverage threshold would therefore create false `NOT_SCORABLE` outcomes. That metric remains
  visible in shadow telemetry; it is not punitive.

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
- Every attempt now records its explicit trigger (`recognition_pass`, classifier veto, skip,
  timeout, or camera interruption), so outcome metrics can distinguish a learner correction from
  a neutral camera recovery without introducing a parallel event.
- Neutral events include their primary camera reason in analytics while remaining excluded from
  persistence and model data.
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
- The canonical `sign_attempt` event and local migration now carry normalized raw-frame quality
  metrics only: required-hand coverage, clipping, pose coverage/scale, time span/gaps, and a
  normalized tracking-stability signal. No landmarks or video are sent in those metrics.
- Story now presents the same explicit camera-recovery card as other solo flows rather than leaving
  a frozen preview; retry preserves the neutral interruption outcome.

## Practice Media Controls

- Reference clips now use native playback controls and provide restart, 0.5×/0.75×/1× speed,
  mirror, and enlarged-view controls with labelled 44px targets.
- Local attempt replay keeps native scrubbing and now exposes its mirror state. Recordings remain
  local-only and are discarded by the existing Continue/exit cleanup paths.
- Practice camera recovery now also offers receptive practice over the current session’s sign pool;
  it deliberately records receptive—not expressive—mastery.
- Lesson, Practice, Story, and Speed show a “Recognition seems wrong” control after five seconds
  of stable framing. It logs aggregate scores only, clears the local attempt window, and never
  grants rewards or changes mastery.

## Learning Depth From Approved Content

- The Basic Signs screen now includes a reverse explorer over the existing canonical sign data,
  filterable by handshape, location, and movement. It adds no signs, variants, or ASL claims.
- `MINIMAL_PAIR_CANDIDATES.md` records fixture-backed candidates for human ASL review only; none
  are exposed as lessons.

## Mode-Specific Mastery

- Legacy aggregate SRS remains intact while new attempts record receptive or expressive evidence.
- Expressive parameter evidence uses normalized score-to-threshold EMA; absent mode records remain
  unknown rather than being treated as zero.
- The four solo expressive flows now pass each required verifier parameter into that EMA for both
  successful and corrective attempts. Receptive answers still cannot write expressive parameters.
