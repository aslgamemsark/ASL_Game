# Model Status

*Last updated: 2026-08-04 (deployment status + gate mechanism correction only — the dataset/model
sections below are otherwise unchanged since 2026-07-14 and due for a fresher pass). This file is
the living, always-current summary — read this first. For the point-in-time detailed snapshot the
2026-07-14 update was based on, see `docs/ml_reports/ML_INTELLIGENCE_REPORT_20260714.md` and its
companion JSON.*

## 2026-08-04 update — deployment status correction + gate mechanism fix

- **This file's "NOT yet deployed" line for `model_v9` below was stale and wrong.**
  `git log -- web/public/models/signs/` shows `model_v9` was deployed 2026-07-14 (commit
  `77c9e87`) with a load-fix following (`a32c156`, unstripped L2 regularizer config) —
  i.e. it has been the live model this whole time, not a pending decision. `classes.json`
  confirms: 25 classes (24 signs + `NO_SIGN`), matching `model_v9`'s shape, not `model_v4`'s.
- **The gate's `NO_SIGN` handling was the real production defect, not the model's accuracy.**
  A 30-day PostHog sample of every production veto found 87% (108/124) were the model voting
  `NO_SIGN` on attempts the rule verifier had already cleared — `NO_SIGN` is an absence class,
  not a competing sign, and the gate had no business vetoing on it. Fixed in `gatePass`
  (`web/src/engine/gate.ts`); see `docs/PRODUCT_BACKLOG_SAAD.md` QS-002 for the full writeup.
  This does not change any number below — it's a bug in how the gate *used* the model's votes,
  not in the model itself. The genuine sign-vs-sign confusion problem (HELLO↔HOSPITAL etc.,
  Known Issue #2/#6 below) is still open.
- **Classifier is back in shadow mode** (`CLASSIFIER_LOAD_ENABLED = true`, `GATE_ENFORCED =
  false` in `web/src/config/classifier.ts`) — votes are recorded, nothing can block a user.
  Re-enabling enforcement needs the numeric bar documented directly on `GATE_ENFORCED`: ≥95%
  veto precision on ≥200 vetoes across ≥20 users, excluding known non-representative traffic and
  bundle-change days, plus per-sign rollout via `GATE_EXCLUDED_SIGNS`.

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
| Jester (NO_SIGN) | 248 | — | Added 2026-07-14. Sampled 500 clips (250 "Doing other things" + 250 "No gesture") from the full 148,092-clip dataset via Qualcomm's developer portal (see `tools/jester_extract.py`); 248/500 survived MediaPipe's "no hands visible in any frame" filter — a normal yield for this source, not a bug. Raw archive (~22.8GB) deleted after extraction per disk-space constraints; only the extracted landmark JSONs are kept. More can be sampled later by re-selecting different `video_id`s from `data/jester/annotations/` if that's still on disk, or by re-downloading if not. |
| Synthetic NO_SIGN | 400 | — | Regenerable anytime via `python -m tools.make_no_sign_synth` |
| **Total** | **2,445** | **25 classes (24 signs + NO_SIGN)** | |

**Not used, correctly deferred (not skipped by oversight)**:
- **NTU RGB+D** — requires manual account registration + ROSE Lab staff approval. Cannot be automated.

## Model version

- **Training run**: `ml/runs/model_v9` (2026-07-14, cache `data/cache_full.npz` rebuilt with Jester added, 37/80 epochs, early-stopped)
- **Results**: train accuracy 99.66%, val accuracy 85.10%, **test accuracy 79.76%** (up from model_v7's 78.23% — a small, real improvement from the added data, not a step change). Macro F1 0.738 (up from 0.728), weighted F1 0.793 (up from 0.777).
- **NO_SIGN**: recall 92.5% (down from model_v7's 94.9%), false-positive rate 7.5% (up from 5.1%), false-negative rate 10.9% (up slightly from 10.4%). **This is a mixed result, not a clean win** — adding Jester improved overall sign classification slightly but made the NO_SIGN class itself slightly noisier, plausibly because Jester's "Doing other things"/"No gesture" clips are visually more varied than the synthetic/HMDB51 negatives the model had been tuned against. Worth revisiting with `class_weight` reweighting (Known Issue #5) rather than more raw NO_SIGN volume.
- **Cross-dataset holdout check specifically for Jester** (`ml/runs/model_v10`, `--holdout-origin jester`): training with Jester held out completely and testing only on its 248 clips gives **71.8% accuracy** vs. that run's own normal test accuracy of 79.5% — a **7.7-percentage-point gap**. This is much smaller than the 33-point MS-ASL gap (see below), meaning: (a) the model already rejects *most* Jester-style casual motion as NO_SIGN even without ever seeing Jester examples (HMDB51 + synthetic negatives generalize reasonably well to it), but (b) there's still a real, non-trivial slice of Jester's specific visual style the model only gets right after training on it — i.e., Jester data *is* adding genuine, non-redundant negative-class diversity, not just volume. This directly supports keeping Jester in the training set going forward.
- **NOT yet deployed** — `web/public/models/signs/` still has whichever model was live before tonight. Deploying `model_v9` is a deliberate next step, not done automatically (see Recommended next steps).
- **Important caveat, still applies**: the earlier cross-dataset holdout check on MS-ASL (train on everything except MS-ASL, test only on MS-ASL) showed accuracy drops from ~74% to **41.4%** on data the model never saw during training — a much bigger gap than Jester's 7.7 points. The 79.8%-style numbers measure within-distribution performance (test clips drawn from the same sources as training); real-world accuracy on genuinely novel recording conditions should still be expected to be meaningfully lower than the headline number, especially for the *sign* classes (MS-ASL-sourced) more than the *NO_SIGN* class (where Jester's addition demonstrably closes some of this gap).
- **Which model is actually deployed**: `web/src/config/classifier.ts`'s `MODEL_URL` points at a fixed path (`web/public/models/signs/`) — check `git log -- web/public/models/signs/` for the most recent "Deploy model_vN" commit message to know what's currently live (convention introduced 2026-07-14; not automated).

## Known issues

1. **[FIXED 2026-07-14, but re-verify after any future ml/dataset.py change]** Train/inference feature-slotting parity — `ml/dataset.py` and `web/src/engine/sequenceFeatures.ts` must always agree on how hands are slotted (by dominant/nondominant role, not raw handedness). A parity test (`web/tests/feature-parity.test.ts`) now has a fixture specifically designed to catch this class of bug (dominant hand raw-labeled "Left") — if this test file is ever modified, make sure that specific check survives.
2. **Residual rule-verifier chance-pass risk**: synthetic adversarial testing found DOCTOR, NURSE, MEDICINE, HOSPITAL, HELP, BREATHE, MORE, WRITE, and several fingerspelling letters can still be satisfied by chaotic random motion under specific circumstances (random handshape coincidentally matching a pattern + location tolerance overlapping by chance). Needs fresh live-camera `CalibrationPage` recordings before further threshold tightening — do NOT tighten blind, several past over-tightening attempts this session caused real-signer false-fails that had to be walked back with calibrated slack terms instead.
3. **EMERGENCY has only 12 training clips** — excluded from the ML gate by existing design (`GATE_EXCLUDED_SIGNS` in `web/src/config/classifier.ts`); do not re-include until real clip count grows substantially.
4. **6 duplicate clip groups** (14 clips total) across WLASL/MS-ASL, not deduplicated in the current cache — low practical impact at this scale, worth fixing before the next data refresh.
5. **No explicit `class_weight`** in the training loop — imbalance is currently offset only by augmentation volume, not loss reweighting.
6. **Real cross-dataset generalization gap found**: holding MS-ASL out entirely during training and testing on it shows a 33-percentage-point accuracy drop (74.2% → 41.4%) vs. the normal in-distribution test split. The model relies partly on dataset-specific characteristics, not purely sign-invariant features. Expect real-world accuracy on genuinely novel recording conditions to be meaningfully below the 79.8% headline test accuracy. The equivalent gap for the NO_SIGN class specifically (Jester holdout) is much smaller — 7.7 points — suggesting this generalization problem is concentrated in the *sign* classes (which lean on ASL Citizen/WLASL/MS-ASL) more than the negative class.
7. **Adding Jester slightly regressed NO_SIGN precision/recall** even though it improved overall test accuracy — see Model version above. **Tested and ruled out**: `class_weight` reweighting (Known Issue #5) was tried (`ml/runs/model_v11`, now available via the opt-in `--class-weight` flag) and made it substantially *worse* — test accuracy 79.8%→77.6%, NO_SIGN recall 92.5%→80.5%, FPR 7.5%→19.5%. Reason: NO_SIGN is now one of the *largest* classes (977 raw clips across HMDB51/synthetic/Jester, more than most real signs), so inverse-frequency weighting downweights it to upweight thin classes like EMERGENCY — directly fighting the goal of rejecting nonsense. Left disabled by default. Remaining candidate: some of the 248 kept Jester clips may be lower-quality MediaPipe extractions (partial hand visibility) that a review-queue step (see `docs/REAL_WORLD_DATA_COLLECTION_REVIEW.md` Section 4/6) would catch before training — not yet tried.

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
- Registered for and downloaded the Jester dataset (Qualcomm developer portal), sampled 500 "Doing other things"/"No gesture" clips, extracted 248 as NO_SIGN landmark clips (`tools/jester_extract.py`), rebuilt the cache, retrained (`model_v9`), and ran a Jester-specific cross-dataset holdout (`model_v10`) — see Model version above. Raw Jester archive deleted afterward to reclaim disk space (~23GB freed).
- Wrote `docs/REAL_WORLD_DATA_COLLECTION_REVIEW.md` — a full audit of the real-user telemetry pipeline (consent, attempt logging, Supabase schema), scored 5/10, with a concrete schema migration proposal.

## Remaining manual tasks (need the project owner)

1. Record fresh CalibrationPage takes for the 8 signs flagged in "Known issues" #2, before any further rule-verifier tightening.
2. Review the full audit artifact's recommendations and decide which future-work items to prioritize.
3. Decide on `collectTrainingData`'s opt-out default now that "thousands of users" is the stated production target (currently defaults to enabled/opt-out) — see `docs/REAL_WORLD_DATA_COLLECTION_REVIEW.md` Section 8's identity-coupling note before deciding.
4. Decide whether to deploy `model_v9` (see Recommended next steps).
5. Consider building the review-queue / human-in-the-loop step described in `docs/REAL_WORLD_DATA_COLLECTION_REVIEW.md` before real-user `training_samples` volume grows much further.

## Recommended next steps (prioritized)

1. ~~Confirm tonight's training run completed cleanly~~ — done, see Model version above.
2. ~~Cross-dataset holdout evaluation~~ — done for `ms_asl` (33pp gap) and `jester` (7.7pp gap) this session; repeat for `wlasl` and `asl_citizen` if time allows.
3. Deploy `model_v9` (update `web/public/models/signs/`, commit with a "Deploy model_v9" message per the versioning convention) — it's the best candidate so far (79.8% test accuracy, NO_SIGN recall 92.5%); `model_v11` (class-weighted) is strictly worse on every metric and should NOT be deployed. Still not deployed automatically — weigh the NO_SIGN recall dip vs. `model_v7` (92.5% vs 94.9%) before deciding.
4. ~~Add `class_weight` to `ml/train.py`~~ — done and tested; it made NO_SIGN rejection worse (Known Issue #7), not better. Left as an opt-in flag, not a fix. Next idea to try instead: filter the 248 Jester clips by hand-visibility coverage before training, since low-quality partial-occlusion extractions are the remaining unruled-out cause of the regression.
5. Manually test in the browser: flail randomly in front of the camera, confirm NO_SIGN now catches it; perform real signs correctly, confirm no new false-fails from tonight's rule-verifier changes. **Pay particular attention to HELLO** — it has the highest false-rejection rate of any sign (Section 9/10 of the full report) and is worth a specific live check.
6. Work through "Remaining manual tasks" above.
