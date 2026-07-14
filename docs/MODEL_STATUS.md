# Model Status

*Last updated: 2026-07-14. This file is the living, always-current summary — read this first.
For the point-in-time detailed snapshot this update was based on, see
`docs/ml_reports/ML_INTELLIGENCE_REPORT_20260714.md` and its companion JSON.*

## Current architecture

- **Rule verifier** (authoritative): `core/verifier.py` (Python) / `web/src/engine/verifier.ts`
  (browser) — per-parameter (handshape, location, movement, orientation, NMM) scoring against a
  declared `Sign` schema. Never averaged: every `required` parameter must individually clear its
  threshold.
- **ML disambiguation layer** (veto-only, optional): Bidirectional GRU, 105,353 parameters,
  trained on 48-frame × 86-feature landmark sequences. Can only REJECT a rule-pass when
  confident the user signed something else (or nothing at all) — never confirms a pass the rules
  didn't already grant. See `web/src/engine/gate.ts`.
- **Landmarks**: MediaPipe Tasks API (Hand + Pose), local/client-side only — no video or landmark
  streaming to a server for recognition.

## Datasets in use

| Source | Clips | Classes covered | Status |
|---|---|---|---|
| ASL Citizen | 616 | 17 signs | At its practical ceiling — this is the dataset's full available count for our vocabulary, confirmed 2026-07-14 |
| WLASL | 186 | 24 signs | At its practical ceiling for automated extraction — 0/182 remaining candidate clips are downloadable (dead ~2019 links), confirmed 2026-07-14 |
| MS-ASL | 666 | 22 signs | 61% yield of 1,089 candidates; some further yield may be possible on retry but expect diminishing returns (dead-link decay, same as WLASL) |
| HMDB51 (NO_SIGN) | 329 | — | Capped by design (50/class × 9 relevant classes); could extract more per class if desired |
| Synthetic NO_SIGN | 400 | — | Regenerable anytime via `python -m tools.make_no_sign_synth` |
| **Total** | **2,197** | **25 classes (24 signs + NO_SIGN)** | |

**Not used, both correctly deferred (not skipped by oversight)**:
- **NTU RGB+D** — requires manual account registration + ROSE Lab staff approval. Cannot be automated.
- **Jester** — a *better-matched* NO_SIGN source than HMDB51 (webcam hand-gesture domain with a purpose-built negative class), but gated behind a Qualcomm developer-portal registration. **Recommended: register when convenient, then re-run the NO_SIGN pipeline with Jester added.**

## Model version

- **Training run**: `ml/runs/model_v8` (started 2026-07-14, cache `data/cache_full.npz`, 80 max epochs, early-stopping enabled)
- **As of this writing, training was still in progress.** This file will be updated with final train/val/test accuracy, NO_SIGN recall/FPR/FNR, and per-class metrics once complete — check `ml/runs/model_v8/metrics.json` directly if this file hasn't been refreshed yet.
- **Which model is actually deployed**: `web/src/config/classifier.ts`'s `MODEL_URL` points at a fixed path (`web/public/models/signs/`) — check `git log -- web/public/models/signs/` for the most recent "Deploy model_vN" commit message to know what's currently live (convention introduced 2026-07-14; not automated).

## Known issues

1. **[FIXED 2026-07-14, but re-verify after any future ml/dataset.py change]** Train/inference feature-slotting parity — `ml/dataset.py` and `web/src/engine/sequenceFeatures.ts` must always agree on how hands are slotted (by dominant/nondominant role, not raw handedness). A parity test (`web/tests/feature-parity.test.ts`) now has a fixture specifically designed to catch this class of bug (dominant hand raw-labeled "Left") — if this test file is ever modified, make sure that specific check survives.
2. **Residual rule-verifier chance-pass risk**: synthetic adversarial testing found DOCTOR, NURSE, MEDICINE, HOSPITAL, HELP, BREATHE, MORE, WRITE, and several fingerspelling letters can still be satisfied by chaotic random motion under specific circumstances (random handshape coincidentally matching a pattern + location tolerance overlapping by chance). Needs fresh live-camera `CalibrationPage` recordings before further threshold tightening — do NOT tighten blind, several past over-tightening attempts this session caused real-signer false-fails that had to be walked back with calibrated slack terms instead.
3. **EMERGENCY has only 12 training clips** — excluded from the ML gate by existing design (`GATE_EXCLUDED_SIGNS` in `web/src/config/classifier.ts`); do not re-include until real clip count grows substantially.
4. **6 duplicate clip groups** (14 clips total) across WLASL/MS-ASL, not deduplicated in the current cache — low practical impact at this scale, worth fixing before the next data refresh.
5. **No explicit `class_weight`** in the training loop — imbalance is currently offset only by augmentation volume, not loss reweighting.

## Completed this session (2026-07-14)

- Fixed `ml/dataset.py`'s dominant/nondominant hand-slotting bug (training side).
- **Found and fixed the same bug on the inference side** (`sequenceFeatures.ts`) — the most significant finding of the session; would have silently miscalibrated any model trained after the training-side fix.
- Fixed `movement.ts`'s LINEAR (no monotonicity check) and REPEATED (no interval-regularity check) rule-verifier scoring gaps.
- Added `origin` field tracking + `--holdout-origin` cross-dataset validation mode to the ML pipeline.
- Added NO_SIGN class support end-to-end: synthetic chaotic-motion generator, HMDB51 extraction, MS-ASL extraction, NO_SIGN-specific metrics (FPR/FNR/recall) in `ml/train.py`.
- Added keypoint-dropout augmentation (partial-occlusion robustness).
- Added train/val/test accuracy + per-class precision/recall/F1 logging (previously only test accuracy was recorded).
- Audited every `required: false`/loose-threshold sign definition; fixed a zero-fixture-coverage gap on YOU.
- Full architecture/dataset/feature-engineering/performance/privacy research audit — see the artifact published this session.

## Remaining manual tasks (need the project owner)

1. Register for Jester dataset access (Qualcomm developer portal, ~5 min).
2. Record fresh CalibrationPage takes for the 8 signs flagged in "Known issues" #2, before any further rule-verifier tightening.
3. Review the full audit artifact's recommendations and decide which future-work items to prioritize.
4. Decide on `collectTrainingData`'s opt-out default now that "thousands of users" is the stated production target (currently defaults to enabled/opt-out).

## Recommended next steps (prioritized)

1. Confirm tonight's training run completed cleanly; review `metrics.json` for train/val/test accuracy gap and NO_SIGN recall/FPR/FNR.
2. Run cross-dataset holdout evaluation (`--holdout-origin` per source) to confirm the model generalizes rather than memorizing dataset artifacts.
3. Deploy the new model (update `web/public/models/signs/`, commit with a "Deploy model_v8" message per the new versioning convention) — only after step 1-2 look healthy.
4. Manually test in the browser: flail randomly in front of the camera, confirm NO_SIGN now catches it; perform real signs correctly, confirm no new false-fails from tonight's rule-verifier changes.
5. Work through "Remaining manual tasks" above.
