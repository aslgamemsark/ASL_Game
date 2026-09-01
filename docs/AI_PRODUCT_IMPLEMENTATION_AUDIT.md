# QuickSign Product Trust Implementation Audit

## External-review remediation — 2026-09-01

- Reconciled the product-trust work with `origin/main` commit `50850b7` in local merge commit
  `69f0da4`. Conflicts in camera preview, authentication/progress sync, sign/verifier data,
  recognition, and all camera pages were resolved by retaining main's recovery/performance fixes
  alongside the product-trust outcome, privacy, mastery, and accessibility behavior.
- Added a tokenized attempt lifecycle. A normal PASS/phase transition stops recognition without a
  camera outcome; a real denied/error/stalled/lost camera finalizes the active token once as
  `NOT_SCORABLE`; stale classifier promises and duplicate boundaries cannot finalize it again.
- Speed now freezes the remaining clock and current sign while the camera is unavailable, then
  resumes the same sign and time after recovery. Neutral interruption does not advance the queue or
  reset combo.
- Skip and timeout retain the current sign-level expressive miss policy only when scorable, but
  deliberately send `params: undefined`; a transient last verifier frame can no longer create a
  false parameter weakness.
- Legacy migration backfill now maps only `passed IS TRUE` to `PASS`. Historical unsuccessful rows
  stay nullable because their old camera/trigger semantics cannot distinguish correction from an
  unscorable attempt.
- Raw evidence now reports honest, shadow-only `normalizedWristMotion`; missing hands do not inflate
  it. Signer scale is normalized per valid frame before averaging. No quality threshold was enabled.
- Omitted SRS mode again uses aggregate legacy history; explicit receptive/expressive modes use
  their own history with aggregate fallback.
- Recognition disputes require five continuous seconds of verifier disagreement plus good raw hand
  and framing evidence. The event no longer claims a finalized outcome and contains no landmarks,
  video, or PII; the action clears local recognition state only.
- Compact reference clips expose only one 44px Enlarge control. Expanded clips keep restart, rate,
  mirror, and scrubbing; Chromium uses native media controls while WebKit uses an accessible native
  range input because WebKit's controls formatter throws on these clips. Captions cannot intercept controls.
- Commercial release builds now strip `dist/models/signs` while classifier loading and gate
  enforcement remain false. Research weights remain in the repository for local work pending human
  dataset/model licensing review.
- Attempt analytics and local migration now carry `evidence_schema_version = 1` and
  `recognition_version = rules-v1`; expressive parameter mastery stores the same provenance so
  future scoring semantics are distinguishable from legacy records.
- New-install speech defaults off without overriding an existing persisted preference.

### Current local verification

- Vitest: 78 files passed; 837 passed, 9 expected-fail, 10 todo (856 total).
- Production build: passed; `dist/models/signs/model.json` absent.
- Lint: completed with warnings and no errors; no new warning category was introduced.
- Production dependency audit: 0 vulnerabilities.
- Focused responsive navigation/media Playwright: 18 passed, 0 failed across Chromium, Android,
  and WebKit/iPhone-sized projects.
- Full canonical Playwright: 161 passed, 7 intentional platform/capability skips, 0 failed
  (168 total, 6.0 minutes on the final exact-code run).
- Multiplayer Playwright: command exited 0 with all 27 cases skipped because the required local
  Supabase stack was not running; no hosted service was contacted or changed.

## Baseline — 2026-08-31

- Working branch: `codex/quicksign-product-trust`, created from `6829bda`.
- Production origin: `https://quicksignn.vercel.app`.
- The original branch diverged from main. Current `origin/main` (`50850b7`) is now locally merged;
  the conflict set and resolution are recorded in the remediation section above.
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

- `npm test -- --run` passed: 785 tests, 9 documented TODOs.
- `npm run build` passed on 2026-09-01.
- `npm run lint` completed with existing warnings only; no errors or new warning category.
- `npm audit --omit=dev` is clean after lockfile-only updates for transitive DOMPurify and nanoid
  advisories.
- `npm run test:multiplayer` starts its isolated local configuration cleanly; its 27 cases skip
  because the required local Supabase stack is not running.
- Focused Chromium Playwright checks passed: desktop Explore visibility/navigation and one main
  landmark.
- Full Playwright completed: 161 passed, 7 intentional skips, 0 failed across all 168 cases.
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
  reason, quality, and evidence-version columns. Only legacy successes backfill to `PASS`; legacy
  unsuccessful rows remain NULL (not classifiable under current semantics). It has not been applied.
- Persisted scorable attempt outcomes into the migration’s `outcome` column; neutral outcomes are
  intentionally excluded from both `sign_attempts` persistence and `training_samples`.

## Recognition Outcome Contract

- Canonical `PASS` and `NEEDS_CORRECTION` values now accompany every rule-pass/classifier-veto
  attempt and flow through the existing `sign_attempt` analytics event.
- Every attempt now records its explicit trigger (`recognition_pass`, classifier veto, skip,
  timeout, or camera interruption), so outcome metrics can distinguish a learner correction from
  a neutral camera recovery without introducing a parallel event.
- Neutral events include their primary camera reason in analytics while remaining excluded from
  persistence and model data.
- Lesson, Practice, Story, and Speed now send skip/timeout outcomes through one
  `useRecognition.finalizeAttempt` path; unscorable outcomes are analytics-only and never persist.
- Duel and Room now also emit that neutral outcome before a signer's interrupted camera loop stops;
  their existing round scoring remains unchanged.
- `NOT_SCORABLE` is emitted for explicit camera interruptions only. Threshold-based camera
  evidence remains disabled until raw frames are calibrated against valid/degraded fixtures.

## Mode-Aware Review Ordering

- Practice now chooses due items using the selected receptive or expressive track. For expressive
  review, established per-parameter weaknesses take priority over aggregate history; legacy records
  retain their aggregate ordering until fresh mode-specific evidence exists.

## Camera Interruption Safety

- Lesson, Story, and Speed recovery cards now route to the existing receptive Practice experience
  for their current sign pool. That route neither requests a camera nor writes expressive mastery.
- A shared 600 ms debounce announces only a stable primary framing issue through a polite live
  region on Lesson, Practice, Story, and Speed; good/unchanged frames are not narrated.
- The recognition loop now retains a separate raw-frame window before stabilization. Stabilized
  hands may continue to help the verifier, but cannot become observed camera evidence.
- A denied, errored, stalled, or restarted solo camera finalizes the active attempt as
  `NOT_SCORABLE`; it remains analytics-only and does not update progress. Speed rounds also retain
  their combo on a neutral timeout or interruption.
- Threshold-based raw-frame quality decisions remain disabled pending fixture calibration.
- The canonical `sign_attempt` event and local migration now carry normalized raw-frame quality
  metrics only: required-hand coverage, clipping, pose coverage/scale, time span/gaps, and honest
  normalized wrist motion. This signal is non-punitive and shadow-only. No landmarks or video are
  sent in those metrics.
- Story now presents the same explicit camera-recovery card as other solo flows rather than leaving
  a frozen preview; retry preserves the neutral interruption outcome.

## Practice Media Controls

- Reference clips now use native playback controls and provide restart, 0.5×/0.75×/1× speed,
  mirror, and enlarged-view controls with labelled 44px targets.
- Local attempt replay keeps native scrubbing and now exposes its mirror state. Recordings remain
  local-only and are discarded by the existing Continue/exit cleanup paths.
- Practice camera recovery now also offers receptive practice over the current session’s sign pool;
  it deliberately records receptive—not expressive—mastery.
- Lesson, Practice, Story, and Speed show “Recognition seems wrong” only after five seconds of
  sustained verifier disagreement with good raw camera evidence. It logs bounded aggregate evidence
  without inventing an outcome, clears only the local attempt window, and never grants rewards or
  changes mastery.

## Learning Depth From Approved Content

- The Basic Signs screen now includes a reverse explorer over the existing canonical sign data,
  filterable by handshape, location, and movement. It adds no signs, variants, or ASL claims.
- `MINIMAL_PAIR_CANDIDATES.md` records fixture-backed candidates for human ASL review only; none
  are exposed as lessons.

## Mode-Specific Mastery

- Legacy aggregate SRS remains intact while new attempts record receptive or expressive evidence.
- Expressive parameter evidence uses normalized score-to-threshold EMA; absent mode records remain
  unknown rather than being treated as zero.
- The four solo expressive flows pass required verifier parameters into that EMA only for validated
  successful evidence. Skip/timeout misses remain sign-level and carry no parameter observation;
  receptive answers still cannot write expressive parameters.
