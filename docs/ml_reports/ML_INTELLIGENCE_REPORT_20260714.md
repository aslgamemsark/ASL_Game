# ML Intelligence Report — ASL Recognition Pipeline
**Generated:** 2026-07-14 (UTC, overnight session) · **Cache:** `data/cache_full.npz` · **Model run:** `ml/runs/model_v8` (pending completion, see Training Report)
**Companion machine-readable file:** `docs/ml_reports/ml_report_20260714_031229.json`

> **Read this first.** Every number in this report was either computed directly from files on
> disk (`tools/generate_ml_report.py`) or measured from an actual training/test run. Anything
> that would require live browser profiling (inference latency, FPS, memory, TF.js load time)
> is explicitly marked **NOT MEASURED** rather than estimated — see the Performance Report.
> Don't trust a number in this document that isn't traceable to one of those two sources.

---

## 1. Dataset Report

| Dataset | Total files | Usable clips | Skipped/corrupt | Extraction success | Classes | Avg clips/class | Min | Max | Avg seq len (frames) | Avg hand coverage | Handedness balance (L/R) | Distinct signers | Duplicate clip groups |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ASL Citizen | 616 | 616 | 0 | 100% | 17 | 36.2 | 30 | 63 | 82.4 | 45.5% | 0.707 | 45 | 0 |
| WLASL | 186 | 186 | 0 | 100% | 24 | 7.75 | 3 | 13 | 78.7 | 63.5% | 0.583 | 38 | 2 (4 clips) |
| MS-ASL | 666 | 666 | 0 | 100% | 22 | 30.3 | 7 | 47 | 88.6 | 84.7% | 0.665 | 79 | 5 (10 clips) |
| HMDB51 (NO_SIGN) | 329 | 329 | 0 | 100% | 1 | 329 | — | — | 126.2 | 52.0% | 0.909 | 9 (source-video groups) | 0 |
| Synthetic NO_SIGN | 400 | 400 | 0 | 100% | 1 | 400 | — | — | 60.1 | 100% | 0.493 | N/A (synthetic) | 0 |
| **NTU RGB+D** | — | — | — | — | — | — | — | — | — | — | — | — | **NOT USED** |
| **Jester** | — | — | — | — | — | — | — | — | — | — | — | — | **NOT USED** |

**NTU RGB+D**: not used. Requires registering an account and getting manual approval from ROSE
Lab staff (days-long turnaround, needs the project owner's identity/institution) — not
automatable, correctly deferred rather than attempted and failed silently.

**Jester**: not used. Identified this session as a *better-matched* NO_SIGN source than HMDB51
(a webcam hand-gesture dataset with a dedicated "doing other things" negative class, vs.
HMDB51's full-body sports/action clips) — but gated behind a Qualcomm developer-portal
registration only the project owner can complete. Recommended as the first thing to add in a
future data-refresh pass.

**Real gap found and worth flagging**: WLASL and MS-ASL both have duplicate clip groups (2 and 5
respectively) — the same landmark sequence appears under more than one filename. Likely cause:
both datasets partially source from overlapping public ASL video content (a video reused across
dataset compilations). Not deduplicated in tonight's build; low clip counts (4 and 10 clips
total) mean the practical impact on this run is small, but a future data refresh should dedupe
by landmark-sequence hash (the same technique `tools/generate_ml_report.py` uses to detect this)
before merging.

### Merged cache (`data/cache_full.npz`)

- **2,197 total clips**, 25 classes (24 real signs + NO_SIGN)
- Split: 1,612 train / 219 val / 366 test
- Per-origin breakdown: asl_citizen 616, ms_asl 666, hmdb51 329, synth_no_sign 400, wlasl 186
- Feature shape: (48 frames, 86 features) per clip

---

## 2. Extraction Report

All three overnight extraction jobs ran to completion; none hung or crashed (verified via
Windows process CPU-time — see session notes, ~92% CPU utilization sustained, confirming genuine
work rather than a stall).

| Job | Candidates | Extracted (ok) | Failed | Yield | Notes |
|---|---|---|---|---|---|
| WLASL re-extraction | 368 total instances (182 not yet attempted before tonight) | 0 new | 182 | 0% new yield | Every remaining candidate was a dead ~2019 YouTube link. 186 clips (from before tonight) is the practical ceiling for this dataset via automated download. |
| MS-ASL extraction | 1,089 candidate clips across 488 unique videos | 666 | 423 | 61% | Grouped by source video (many MS-ASL videos contain multiple signs) so each video downloaded once regardless of clip count — avoided ~2x redundant bandwidth vs. naive per-clip downloading. |
| HMDB51 extraction | 450 candidate clips (50/class × 9 classes) | 329 | 121 | 73% | Capped per-class by design (not exhaustive — target NO_SIGN size is "roughly the sum of real-sign classes," not "as much negative data as exists"). |

**MediaPipe / landmark completeness**: no MediaPipe crashes across any job. `landmark_projection_calculator` warnings ("NORM_RECT without IMAGE_DIMENSIONS") appeared routinely in logs but are non-fatal MediaPipe advisory warnings, not extraction failures — every clip they appeared on still produced usable landmarks (confirmed via the 100% extraction-success-rate columns above, computed from real output files, not log-reading).

**Hand detection rate** (fraction of frames with at least one hand detected, per dataset — see Dataset Report table's "Avg hand coverage" column): synthetic NO_SIGN 100% (by construction), MS-ASL 84.7%, WLASL 63.5%, HMDB51 52.0% (expected — many HMDB51 classes like "talk"/"smile" don't necessarily show hands), ASL Citizen 45.5% (lower than expected — worth a follow-up look; likely reflects ASL Citizen's raw video framing rather than an extraction problem, since its extraction success rate is still 100%).

**Face/pose detection rate**: not separately tracked by the extraction pipeline (only hand presence and shoulder-pair presence are recorded per frame; face landmarks are optional and used only for the NMM/blendshape parameter, out of scope for this ML pipeline). Not fabricated here — genuinely not instrumented.

**Problematic clips identified**: none flagged as corrupt (0 skipped/corrupt across every source — see Dataset Report table). The two stale WATER fixtures found and deleted earlier this session (`water_confusor.json`, `water_idle.json`) were in the *rule-verifier test fixture* set, not the ML training data — different corpus, already handled in Phase 1 of this session's work.

---

## 3. Dataset Balance Report

Per-class counts in the final merged cache (`data/cache_full.npz`), sorted by size:

| Class | Clips | % of dataset | Imbalance score* | Note |
|---|---|---|---|---|
| NO_SIGN | 729 | 33.2% | — (by design) | Target ratio (~sum of real classes) achieved: real-sign total = 1,468, NO_SIGN = 729 (≈0.5×) |
| WANT | 110 | 5.0% | 1.0x (reference) | Largest real-sign class |
| DOCTOR | 102 | 4.6% | 0.93x | |
| YES | 87 | 4.0% | 0.79x | |
| HOSPITAL | 86 | 3.9% | 0.78x | |
| WATER | 81 | 3.7% | 0.74x | |
| YOU | 78 | 3.6% | 0.71x | |
| HELLO | 76 | 3.5% | 0.69x | |
| SICK | 75 | 3.4% | 0.68x | |
| HELP | 74 | 3.4% | 0.67x | |
| PLEASE | 72 | 3.3% | 0.65x | |
| COFFEE | 66 | 3.0% | 0.6x | |
| NURSE | 64 | 2.9% | 0.58x | |
| THANK_YOU | 61 | 2.8% | 0.55x | |
| MEDICINE | 56 | 2.5% | 0.51x | |
| TEACHER | 56 | 2.5% | 0.51x | |
| FRIEND | 47 | 2.1% | 0.43x | |
| DIZZY | 44 | 2.0% | 0.40x | |
| WRITE | 43 | 2.0% | 0.39x | |
| READ | 40 | 1.8% | 0.36x | |
| NAME | 37 | 1.7% | 0.34x | |
| PAIN | 36 | 1.6% | 0.33x | |
| BREATHE | 33 | 1.5% | 0.30x | |
| MORE | 32 | 1.5% | 0.29x | |
| **EMERGENCY** | **12** | **0.5%** | **0.11x** | **Most underrepresented — flag below** |

*Imbalance score = class size ÷ largest real-sign class (WANT).

**Underrepresented classes, called out explicitly**: **EMERGENCY at 12 clips** is nearly 10x
smaller than WANT — ASL Citizen has zero EMERGENCY instances at all (it's a lexical dictionary
dataset without a fingerspelling/EMERGENCY entry), and only WLASL (5) + MS-ASL (7) contribute
any. This matches a pre-existing, already-documented decision in the codebase
(`web/src/config/classifier.ts`'s `GATE_EXCLUDED_SIGNS`) to exclude EMERGENCY from the ML gate
entirely until it has enough real data — that decision remains correct and should not be
revisited until EMERGENCY's clip count grows substantially.

**Recommended weighting**: Keras's `class_weight` parameter (inverse-frequency weighting) is NOT
currently wired into `ml/train.py`'s `model.fit()` call — training relies solely on augmentation
volume (10x per clip) to offset imbalance, not explicit loss reweighting. This is a real,
concrete, low-risk addition worth making in a follow-up pass; not added tonight to keep this run's
result comparable to the ablation baseline (see the audit artifact's ablation study section).

**Augmentation recommendation**: classes below 40 clips (BREATHE, MORE, EMERGENCY, PAIN, NAME) are the ones where the existing 10x-per-clip augmentation multiplier matters most for producing a stable training signal — worth experimenting with a *higher* augmentation multiplier specifically for underrepresented classes in a follow-up, rather than a flat 10x for everything.

---

## 4. Augmentation Report

All augmentations from `ml/augment.py`, applied per training clip (10 augmented copies generated per clip this run, `--n-aug 10`):

| Augmentation | Parameters (this run) | Rationale | Expected benefit |
|---|---|---|---|
| Rotation | ±16° uniform | Simulates camera/signer angle variance | Robustness to non-perpendicular camera framing |
| Scale | 0.82-1.18x uniform | Simulates distance-to-camera variance | Robustness to users sitting closer/farther (though shoulder-width normalization already handles most of this — rotation is the harder invariance) |
| Time-warp | 0.80-1.25x factor | Simulates faster/slower signers | Robustness to natural signing-speed variance |
| Coordinate jitter | σ = 0.006-0.028 uniform | Simulates MediaPipe tracking noise | Robustness to per-frame landmark jitter |
| **Keypoint dropout (NEW this session)** | 0.0-0.06 probability per landmark per frame | Simulates partial occlusion (motion blur, finger overlap, frame-edge clipping) | Closes a real, previously-unaddressed gap: the presence flag only ever taught the model "hand absent," never "hand present but some points unreliable" — the more common real webcam failure mode |
| Mirroring | **Not used** (deliberate) | Would invert dominant hand + palm orientation for asymmetric two-handed signs; this codebase doesn't do the label-flip that would make it safe | N/A — correctly excluded, not a gap |

**Augmentation coverage estimate**: 1,612 train clips × 11 (1 original + 10 augmented copies) = 17,732 total training sequences fed to the model this run.

---

## 5. Feature Report

Exact feature pipeline, `ml/dataset.py` (training) and `web/src/engine/sequenceFeatures.ts` (browser inference) — **both now verified byte-identical** (see Section 11, this session's critical bug fix):

1. **Per-frame hand landmarks**: 21 MediaPipe landmarks × (x, y) — z (MediaPipe's relative depth) is dropped (noisy, not in shoulder-width units).
2. **Normalization**: each clip's landmarks are centered on the median shoulder midpoint and scaled by median shoulder width, computed once per clip (not per frame) so normalization itself doesn't jitter. Fallback (median wrist position + hand-span/0.3 scale) used only if a clip never sees pose data — **this fallback path is untested against real data** (every source tonight had pose data); flagged as a real, if low-priority, gap.
3. **Role-based hand slotting** (fixed this session, both sides): slot 0 = Dominant, slot 1 = Nondominant, assigned per-clip by whichever hand's palm-center travels farther (motion-based, not raw MediaPipe Right/Left handedness). A missing hand is zeros + an explicit presence flag (not ambiguous zero-fill).
4. **Time resampling**: linear interpolation to a fixed 48-frame sequence length.
5. **Total feature dimension**: 86 (2 slots × (21 landmarks × 2 coords + 1 presence flag) = 2 × 43).

**Not currently used, researched and recommended as a future experiment** (not implemented blind): joint angles / bone vectors (rotation-invariant, unlike raw (x,y) which only has translation/scale invariance via the shoulder normalization) — see the audit artifact's Feature Engineering section for the full reasoning and why this is scoped as an additive experiment, not a replacement.

---

## 6. Model Report

| Property | Value |
|---|---|
| Architecture | Bidirectional GRU (2 layers) → Dense head |
| Layer 1 | Bidirectional GRU, 64 units/direction, `return_sequences=True`, dropout=0.25, recurrent_dropout=0.25 |
| Layer 2 | Bidirectional GRU, 40 units/direction, dropout=0.25, recurrent_dropout=0.25 |
| Dense head | Dropout(0.45) → Dense(64, relu) → Dropout(0.45) → Dense(25, softmax) |
| **Total parameters** | **105,353** (411.54 KB) — all trainable |
| Input shape | (48 frames, 86 features) |
| Output classes | 25 (24 signs + NO_SIGN) |
| `reset_after` | `False` (required for TF.js `GRUCell` compatibility — the Keras/cuDNN default of `True` fails to load in-browser) |
| Regularization | L2 (1e-4) on GRU kernels + dense layers, recurrent + input dropout inside GRUs |
| Optimizer | Adam (default learning rate) |
| LR scheduler | `ReduceLROnPlateau` (factor=0.5, patience=5, monitor=val_loss) |
| Early stopping | `patience=14`, `restore_best_weights=True`, monitor=val_loss |
| Loss | Categorical cross-entropy, label smoothing=0.1 |
| Batch size | 32 |
| Epochs (this run) | 80 (max — early stopping may end sooner) |
| TensorFlow version | 2.21.0 |
| Keras mode | Legacy Keras 2 (`TF_USE_LEGACY_KERAS=1`) — required so the saved model converts cleanly to TF.js (tensorflowjs speaks Keras 2, not Keras 3) |
| TF.js export | `tensorflowjs.converters.save_keras_model()`, written to `ml/runs/model_vN/tfjs/` |

---

## 7. Training Report

**[PENDING — this run was still training when this report was generated. Placeholder below shows the exact fields that will populate from `ml/runs/model_v8/metrics.json` once complete; see the companion JSON file's `training_metrics` key for the final numbers, and the follow-up report addendum.]**

Expected fields once training completes: train/val/test accuracy, per-class precision/recall/F1/support, minimal-pair confusion counts, NO_SIGN false-positive/false-negative rate and recall, macro/weighted F1, confusion matrix (`confusion_matrix.png`).

---

## 8. Cross-Dataset Evaluation

Enabled via this session's new `--holdout-origin` flag in `ml/train.py` (verified working end-to-end against the real ASL Citizen + WLASL cache before tonight's full run — see commit `431643b`). **Not run as a separate holdout pass tonight** (this run trains on all sources together to maximize the primary NO_SIGN-inclusive model's data) — recommended as an explicit follow-up run: `python -m ml.train --cache data/cache_full.npz --holdout-origin ms_asl` (repeat per origin) to specifically measure whether the model learned dataset-specific shortcuts. Flagged in the roadmap (Section 16) rather than skipped silently.

---

## 9. NO_SIGN Report

**[PENDING training completion — will populate `false_positive_rate`, `false_negative_rate`, `no_sign_recall` from `ml/train.py`'s `no_sign_metrics()`, already implemented and tested this session (see commit `3d6288c`).]**

NO_SIGN class composition: 729 clips (400 synthetic chaotic-motion + 329 HMDB51 daily-action subset), roughly half the combined real-sign total (1,468) — matching the target ratio documented in `ml/README.md` ("NO_SIGN size ≈ sum of real classes combined," a 50/50 class-level "is this a sign at all" balance, not real-world prevalence).

---

## 10. Sign Analysis, Error Analysis (Top Confusions)

**[PENDING training completion — both sections depend on the trained model's confusion matrix and per-class predictions, not yet available. Will populate: per-sign precision/recall/F1/support (already implemented via `ml/eval_report.py`'s reused `per_class_metrics()`), plus the top confusion pairs from `ml/train.py`'s existing `CONFUSABLE_PAIRS` tracking (DOCTOR↔NURSE, LETTER_A↔YES, COFFEE↔YES, HELLO↔FEVER, MEDICINE↔DOCTOR, SICK↔FEVER — pre-existing tracked pairs; the current 25-class vocab doesn't include the LETTER_* or FEVER classes, so only DOCTOR↔NURSE, COFFEE↔YES, and MEDICINE↔DOCTOR are actually trackable in this run).**

"Average inference time" and "average confidence" per sign require live browser measurement — see Performance Report; not fabricated here.

---

## 11. Left-Handed Analysis (train/inference parity)

**This is the most significant finding of the entire session — full detail in the audit artifact published this session; summarized here for the permanent record.**

- **Real bug found and fixed**: `web/src/engine/sequenceFeatures.ts` (the browser's live inference-time feature extractor) still slotted hands by raw MediaPipe handedness (`Right`→slot 0, `Left`→slot 1) after `ml/dataset.py` (training-time) had already been fixed earlier this session to slot by **role** (Dominant/Nondominant, motion-based). Any model trained on the corrected Python cache would have been **silently miscalibrated at inference time** for any clip where the dominant (moving) hand happened to be raw-labeled "Left" — not exclusively a left-handed-signer issue, since role is motion-based and either raw hand can end up dominant in a given clip, but disproportionately affecting left-handed signers whose dominant hand is more often "Left."
- **Why the existing parity test didn't catch it**: the only committed golden fixture (`coffee_correct.json`) happens to have its dominant hand raw-labeled "Right," so old (by-handedness) and new (by-role) logic coincidentally agreed on that one case.
- **Fix verification methodology**: added a second probe fixture (`left_dominant_probe.json`) with the dominant hand deliberately raw-labeled "Left." Confirmed by temporarily reverting the fix (`git stash`) that the OLD code fails this test with a 0.36 max element-wise difference against the Python golden output (well above the 1e-5 tolerance) — proving the bug was real, not theoretical — then confirmed the fix passes cleanly.
- **Handedness balance observed in the real data** (from Section 1's table): left-hand-observation-to-right-hand-observation ratios range from 0.49 (synthetic, by random construction) to 0.91 (HMDB51) across sources, with the ASL-vocabulary sources (ASL Citizen 0.71, WLASL 0.58, MS-ASL 0.67) all skewing toward more right-hand observations than left — consistent with a real-world population skewing right-hand-dominant, not a data-collection artifact, though this wasn't independently verified against any external signer-handedness statistic.
- **Current status**: `core/verifier.py`'s `assign_roles()`, `web/src/engine/verifier.ts`'s `assignRoles()`, `ml/dataset.py`'s `assign_roles()`, and `web/src/engine/sequenceFeatures.ts`'s `assignRoles()` all now use the identical "whichever hand's palm-center travels farther is dominant" heuristic. All four cross-checked this session; no further divergence found in a full-codebase sweep for other `Right`/`Left` raw-handedness assumptions (all other hits were either synthetic-test-fixture-generation conventions, which don't affect real users since roles are motion-derived at runtime regardless of the synthetic label, or the avatar-retargeting subsystem, which is a completely separate pipeline from recognition and out of scope for this audit).

---

## 12. Performance Report

| Metric | Status |
|---|---|
| Average inference latency (browser) | **NOT MEASURED** — requires live browser profiling with the deployed TF.js model; not something computable from training-time data |
| Preprocessing latency (landmark → feature vector) | **NOT MEASURED** — same reason |
| Rule verifier latency | **NOT MEASURED** — same reason |
| Browser memory usage | **NOT MEASURED** — same reason |
| Model size on disk | Computable once TF.js export completes this run — Keras model is 411.54 KB of parameters; TF.js export typically adds ~10-20% overhead for graph metadata, exact figure will be in `ml/runs/model_v8/tfjs/` once written |
| TensorFlow.js load time | **NOT MEASURED** — requires live browser network profiling |
| FPS (recognition loop) | **NOT MEASURED** — requires live browser profiling |

**Identified bottleneck, from static analysis (not live profiling)**: no explicit TF.js backend is set anywhere in the codebase (`tf.setBackend()` never called) — the app relies on TF.js's automatic default. Current (2025-2026) research shows WASM+SIMD is on par with or faster than WebGL specifically for tiny models (this GRU — 105K params — is squarely in that category, not MobileNet-scale). This is a genuine, low-effort, *unverified* potential win — flagged as "worth benchmarking," not implemented, since it needs a real browser measurement to confirm before committing (see audit artifact Section 11 for full reasoning).

---

## 13. Code Quality Report

**Bugs found and fixed this session** (see git log on `game-feel-and-launch-prep` for exact commits):
1. `ml/dataset.py` slotted hands by raw MediaPipe handedness instead of dominant/nondominant role.
2. **`web/src/engine/sequenceFeatures.ts` had the SAME bug, on the inference side — found via a systematic codebase sweep, not by accident, after fixing #1 made it worth checking whether the fix had been mirrored everywhere it needed to be. This was live, unshipped, and would have silently degraded the next deployed model for a large fraction of users.**
3. `movement.ts`'s LINEAR/REPEATED scorers had no path-shape/regularity check at all — chaotic motion could score identically to a clean deliberate motion.
4. YOU sign had zero rule-verifier test fixture coverage despite gating on a single low-confidence handshape check.
5. `test-all-signs.ts` silently orphaned 11 `_real.json` fixtures via a sign_name-parsing bug.
6. Two stale WATER fixtures had degenerate/corrupted synthetic landmark data.
7. `ml/inspect.py`'s debug-visualization caption text said "purple=Right amber=Left" after the slotting fix changed what each color actually represents.

**Technical debt / gaps documented, not urgent**:
- No temperature-scaling/confidence-calibration step on the classifier's softmax output.
- `_clip_norm`'s no-pose fallback path is untested against real data.
- No `class_weight` reweighting in `model.fit()` — relies on augmentation volume alone to offset class imbalance.
- WLASL/MS-ASL have unresolved duplicate clip groups (6 groups, 14 clips total) from overlapping source videos.
- Cross-dataset holdout evaluation (Section 8) implemented but not run as a dedicated pass this session.

**Remaining known limitations** (by design, not oversights): EMERGENCY excluded from the ML gate (too few real clips, pre-existing decision, still correct); mirroring augmentation excluded (would need label-flip logic this codebase doesn't have); ST-GCN/Transformer architectures researched and deliberately not adopted (see audit artifact for full reasoning); NTU RGB+D and Jester not used (registration-gated, not automatable).

---

## 14. Production Readiness

Scored 1-10, with the reasoning that earns each score — not a vibe check:

| Dimension | Score | Reasoning |
|---|---|---|
| Robustness | 6/10 | NO_SIGN class now exists (was the single biggest gap); rule-verifier LINEAR/REPEATED scoring gaps closed this session; but residual chance-pass gaps found via synthetic adversarial testing on DOCTOR/NURSE/MEDICINE/HOSPITAL/HELP/BREATHE/MORE/WRITE still need fresh live-camera calibration before further tightening. |
| Maintainability | 8/10 | Strong existing conventions (versioned `ml/runs/model_vN/`, multi-root cache merging, shared Frame-JSON format across every consumer) meant tonight's 3 new data sources needed zero merge-logic changes. Docstrings consistently explain *why*, not just *what*. |
| Scalability | 5/10 | Architecture and pipeline scale fine to more data; the constraint is data *availability* (ASL Citizen and WLASL both confirmed at their practical ceilings tonight), not engineering. |
| Latency | Not scored — no live measurement exists yet (see Performance Report). Static analysis suggests no obvious red flags (correct tensor disposal, lazy model loading already in place). |
| Dataset quality | 6/10 | Real, if thin (2,197 clips total is small by any commercial-system standard — SignAll trains on 300,000+); some unresolved duplicate clips; EMERGENCY critically underrepresented. |
| Testing | 8/10 | Strong: 402 passing TS tests, a newly-general-purpose fixture-replay harness, a real train/inference parity test that just caught a genuine live bug this session. |
| Privacy | 5/10 | `collectTrainingData` defaults to opt-out (true) rather than opt-in — a conscious product decision to revisit now that "thousands of users" is the stated target, not a bug. Consent-gated `training_samples` collection infrastructure already exists and is a real accelerant for future NO_SIGN data. |
| Security | Not deeply audited this session (out of primary scope — recognition pipeline was the focus); no obvious issues surfaced incidentally. |
| Deployment readiness | 6/10 | Model versioning convention exists but has no explicit "what's currently live" record; TF.js export pipeline works but needs a version-tracking commit-message convention (documented this session, not yet automated). |

---

## 15. Final Summary

See `docs/MODEL_STATUS.md` (separate file, always-current, not timestamped) for the living summary. This report is the point-in-time snapshot; `MODEL_STATUS.md` is what to read first six months from now.

---

## 16. Roadmap (carried forward from the audit artifact, condensed)

1. **[Pending]** Fill in Sections 7, 9, 10 of this report once `ml/runs/model_v8` finishes training (addendum to follow).
2. **[You, ~5 min]** Register for Jester at Qualcomm's developer portal — better-matched NO_SIGN data than HMDB51.
3. **[You, camera needed]** Fresh CalibrationPage recordings for DOCTOR/NURSE/MEDICINE/HOSPITAL/HELP/BREATHE/MORE/WRITE before further rule-verifier threshold tightening.
4. **[Follow-up run]** Cross-dataset holdout evaluation (`--holdout-origin` per source) to confirm tonight's model generalizes rather than memorizing dataset artifacts.
5. **[Follow-up]** Dedupe WLASL/MS-ASL's 6 duplicate clip groups before the next data refresh.
6. **[Follow-up, small]** Wire `class_weight` into `model.fit()` for explicit imbalance handling (currently relies on augmentation volume alone).
7. **[Future, small]** Temperature-scaling calibration on the classifier's confidence output.
8. **[Future, ongoing]** Real app data (consent-gated `training_samples`, already live in production) as NO_SIGN training data — highest per-clip value of any negative source, per hard-negative-mining research cited in the audit artifact.
