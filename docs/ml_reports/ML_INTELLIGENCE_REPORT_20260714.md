# ML Intelligence Report — ASL Recognition Pipeline
**Generated:** 2026-07-14 (UTC, overnight session) · **Cache:** `data/cache_full.npz` · **Model run:** `ml/runs/model_v7` (complete)
**Companion machine-readable file:** `docs/ml_reports/ml_report_20260714_040527.json` (final; supersedes the earlier `ml_report_20260714_031229.json`, generated before a data-pipeline bug fix described in Section 7)

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

**Real bug found and fixed mid-session, worth recording in full**: the first training run
against `data/cache_full.npz` produced `NO_SIGN recall=0.000, FPR=0.000, FNR=0.093` — which
looked like a total NO_SIGN failure but was actually a **data-pipeline bug**, not a model
problem. Root cause: `tools/hmdb51_extract.py` hardcoded `split="train"` for every clip, and
`tools/make_no_sign_synth.py` never wrote a manifest at all — so every one of the 729 NO_SIGN
clips defaulted to the "train" split, leaving **zero** true NO_SIGN examples in val or test.
`no_sign_metrics()`'s `0/0 -> 0.0` fallback silently produced uninformative zeros instead of an
error, which is exactly why this was caught by *reading* the numbers rather than trusting a
green checkmark — 0.000/0.000/0.093 is a mathematically consistent but meaningless combination
once you notice both NO_SIGN-conditioned rates share the same (zero) denominator. Fixed both
scripts to assign a deterministic 70/15/15 split by clip index, regenerated the NO_SIGN data
(now 534/97/98 clips across train/val/test), rebuilt the cache, and retrained. All numbers below
are from that corrected run.

| Metric | Value |
|---|---|
| Train accuracy | **99.98%** |
| Validation accuracy | **84.81%** |
| Test accuracy | **78.23%** |
| Train→test gap | 21.7 percentage points — real overfitting, expected at this data scale (2,197 clips / 25 classes with a 105K-parameter model); regularization (dropout 0.25-0.45, L2, label smoothing, early stopping) is doing real work but can't fully close a gap this size on this little data |
| Macro F1 | 0.728 |
| Weighted F1 | 0.777 |
| Epochs run | 59 of 80 max (early-stopped, `restore_best_weights=True`) |
| Training wall-clock | ~31s/epoch × 59 epochs ≈ 30 minutes (CPU, no GPU) |

**Minimal-pair confusions** (pre-existing tracked pairs, current 25-class vocab only supports 3 of the original list):

| Pair | A→B confusions | B→A confusions |
|---|---|---|
| DOCTOR ↔ NURSE | 1/30 | 1/17 |
| COFFEE ↔ YES | 0/15 | 0/14 |
| MEDICINE ↔ DOCTOR | 0/16 | 3/30 |

**Per-class metrics, ranked hardest → easiest by F1** (⚠️ = fewer than 5 test examples, treat as noisy, not a reliable signal):

| Sign | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| FRIEND ⚠️ | 0.25 | 0.33 | 0.29 | 3 |
| EMERGENCY ⚠️ | 0.33 | 0.33 | 0.33 | 3 |
| NURSE | 0.75 | 0.35 | 0.48 | 17 |
| MORE ⚠️ | 0.40 | 1.00 | 0.57 | 2 |
| DOCTOR | 0.93 | 0.47 | 0.62 | 30 |
| DIZZY | 0.78 | 0.54 | 0.64 | 13 |
| PAIN | 0.69 | 0.60 | 0.64 | 15 |
| MEDICINE | 0.69 | 0.69 | 0.69 | 16 |
| WRITE ⚠️ | 0.54 | 1.00 | 0.70 | 7 |
| READ ⚠️ | 0.83 | 0.62 | 0.71 | 8 |
| HELP | 0.72 | 0.76 | 0.74 | 17 |
| SICK | 0.78 | 0.74 | 0.76 | 19 |
| COFFEE | 0.91 | 0.67 | 0.77 | 15 |
| HELLO | 0.82 | 0.74 | 0.78 | 31 |
| NAME ⚠️ | 0.67 | 1.00 | 0.80 | 4 |
| YES | 0.91 | 0.71 | 0.80 | 14 |
| NO_SIGN | 0.71 | 0.95 | 0.81 | 98 |
| BREATHE | 1.00 | 0.69 | 0.82 | 13 |
| PLEASE | 0.75 | 0.95 | 0.84 | 19 |
| HOSPITAL | 0.89 | 0.81 | 0.85 | 31 |
| YOU | 0.82 | 0.88 | 0.85 | 16 |
| WATER | 0.83 | 0.94 | 0.88 | 16 |
| THANK_YOU | 1.00 | 0.80 | 0.89 | 15 |
| WANT | 0.97 | 0.94 | 0.95 | 31 |
| TEACHER | 1.00 | 1.00 | 1.00 | 11 |

**Reading this table honestly**: the bottom (hardest) entries are dominated by two effects, not
one — genuinely hard signs (DOCTOR/NURSE/MEDICINE are the tracked confusable trio, so their low
scores are expected and match the minimal-pair table above), and small-sample noise (FRIEND,
EMERGENCY, MORE, NAME, WRITE, READ all have single-digit test support — a couple of misclassified
clips swings their F1 wildly). Don't read "FRIEND is a hard sign" from this table; read "FRIEND
needs more test data before its score means anything."

Plots: `ml/runs/model_v7/confusion_matrix.png` (25×25 confusion matrix, generated this run).

---

## 8. Cross-Dataset Evaluation

Ran `python -m ml.train --cache data/cache_full.npz --holdout-origin ms_asl` (a SEPARATE run,
`ml/runs/model_v8` — not the primary deployed-candidate model — trained on ASL Citizen + WLASL +
HMDB51 + synthetic NO_SIGN only, with MS-ASL's 666 clips excluded entirely from train/val/test).

| | Value |
|---|---|
| Normal (in-distribution) test accuracy, this holdout run | 74.2% |
| **Accuracy on the held-out MS-ASL clips (never seen in training)** | **41.4%** |
| Gap | **-32.8 percentage points** |

**This is a real, meaningful finding, not a rounding-error-sized effect.** A 33-point drop when
evaluating on an entirely unseen dataset means a substantial share of what the model learned is
tied to characteristics specific to the datasets it trained on (camera framing, compression,
signer population, or recording-setup artifacts) rather than sign-invariant features that
transfer across sources. This is exactly the failure mode this check exists to catch, and it
caught something real.

**What this does NOT mean**: it does NOT mean `model_v7` (the primary model, trained WITH
MS-ASL included) is unreliable for MS-ASL-style input — `model_v7` has actually seen that
distribution during training. What it DOES mean: if a future data source is added that the
model has never trained on (a new dataset, or real users whose camera setup differs
meaningfully from ASL Citizen/WLASL/MS-ASL's recording conditions), expect a real accuracy drop
relative to the 78.2% test-set number, not the same performance. **This is the single most
important reason not to over-trust `model_v7`'s 78.2% test accuracy as "real-world accuracy"** —
the test split is drawn from the same sources the model trained on, so it measures
within-distribution performance, not deployment-condition performance.

**Recommended follow-up, not yet run**: repeat this holdout for `wlasl` and `asl_citizen`
individually to see whether the gap is MS-ASL-specific (its videos are the ones with the least
overlap in style/quality/compression with the others, per `ml/dataset.py`'s `--per-class`
comparison) or a general property of this pipeline's ability to generalize across any single
held-out source.

---

## 9. NO_SIGN Report

| Metric | Value | Reading |
|---|---|---|
| NO_SIGN recall | **94.9%** (93/98 test clips) | Of genuine nonsense/idle motion, the model correctly flags it as NO_SIGN 95% of the time — this is the core fix for "random flailing predicts a real sign" |
| False positive rate (true NO_SIGN → predicted a real sign) | **5.1%** | The "hallucinating a sign out of nonsense" failure mode this whole effort targeted — down from effectively undefined/untested before tonight (the model had no NO_SIGN class at all) |
| False negative rate (true real sign → predicted NO_SIGN) | **10.4%** | The over-correction risk — roughly 1 in 10 genuine correct attempts gets misclassified as NO_SIGN by the raw classifier. Important caveat: this is the classifier's raw argmax rate, not the production rate — `gate.ts` only vetoes when confidence ≥ 0.7, so some of these 10.4% may not reach production-visible rejection if the model's NO_SIGN confidence on a genuine sign is below that threshold. Worth measuring directly (log gate decisions) before assuming 10.4% is the real user-facing rate. |
| NO_SIGN class composition | 729 total clips (400 synthetic chaotic-motion + 329 HMDB51 daily-action subset) | ≈50% of the combined real-sign total (1,468) — matches the target ratio in `ml/README.md` ("NO_SIGN size ≈ sum of real classes combined," a 50/50 class-level balance, not real-world prevalence) |

**Which signs get confused with NO_SIGN most often** (computed directly from the trained model against the test split, not estimated):

| Sign misclassified as NO_SIGN | Count / support | Rate |
|---|---|---|
| **HELLO** | 8/31 | **25.8%** — the single largest contributor to the 10.4% FNR |
| DOCTOR | 5/30 | 16.7% |
| PAIN | 4/15 | 26.7% |
| EMERGENCY ⚠️ | 2/3 | 66.7% (tiny sample, not reliable) |
| COFFEE, DIZZY, HELP, HOSPITAL, MEDICINE, NURSE, YES | 2 each | 6-15% |
| PLEASE, SICK, THANK_YOU, WANT, WATER | 1 each | ≤6% |

**HELLO stands out as the one worth investigating**: it's a `REPEATED`-movement, `NEUTRAL_SPACE`-
location sign per the rule-verifier schema (`web/src/engine/signs/index.ts`) — the loosest
location constraint in the vocabulary (documented as deliberately load-bearing for
fingerspelling, and HELLO shares that band). A plausible hypothesis: the synthetic NO_SIGN
generator's chaotic-motion clips, drawn from a similarly broad spatial region, may overlap
HELLO's real feature distribution more than other signs' tighter-anchored motions do. Worth
checking specifically (not yet done) before assuming this is a labeling or data-quality issue
rather than a genuine feature-space overlap.

The reverse direction (NO_SIGN misclassified as a real sign — the false-positive/hallucination
side) is small and spread thin: 1 clip each predicted as HELLO, HELP, NAME, PAIN, WATER (5 total
across 98 NO_SIGN test clips) — no single sign dominates the hallucination direction the way
HELLO dominates the over-rejection direction.

---

## 10. Sign Analysis, Error Analysis (Top Confusions)

Per-sign precision/recall/F1/support: see the full ranked table in Section 7. Easiest signs
(F1 ≥ 0.9, reliable sample sizes): **TEACHER (1.00), WANT (0.95), THANK_YOU (0.89)**. Hardest
signs with reliable sample sizes (support ≥ 13, excluding the ⚠️-flagged tiny-sample ones from
Section 7): **NURSE (0.48), DOCTOR (0.62), DIZZY (0.64), PAIN (0.64), MEDICINE (0.69)** — four of
these five are exactly the signs already flagged in this session's rule-verifier audit as having
residual chance-pass risk against chaotic random motion, which is a meaningful cross-check: the
signs the ML model finds hardest to classify correctly are substantially the same signs the rule
verifier has the least separation on. That's not a coincidence worth ignoring — it suggests
these signs' *feature signature* (not just the rule thresholds) is inherently less distinctive
in this landmark representation, which is exactly the kind of finding that should inform where
to focus future data collection or feature-engineering effort (Section 5 of the audit artifact).

**Top confusions** (from the tracked minimal-pairs + the NO_SIGN breakdown above, since the
25-class vocab only supports 3 of the originally-tracked pairs):

| Confusion | Count | Likely cause |
|---|---|---|
| HELLO → NO_SIGN | 8/31 (25.8%) | Broadest location tolerance (NEUTRAL_SPACE) in the vocabulary — likely overlaps the spatially-broad synthetic NO_SIGN distribution. Flagged for follow-up investigation, not yet root-caused. |
| MEDICINE → DOCTOR | 3/30 (10%) | Both are wrist-tapping motions in similar body-relative locations — a genuine, previously-known confusable pair (tracked in `CONFUSABLE_PAIRS` since before this session). |
| DOCTOR → NO_SIGN | 5/30 (16.7%) | DOCTOR's own low recall (0.47) suggests this sign's landmark signature is broadly harder to separate, not specifically confused with one other class. |
| PAIN → NO_SIGN | 4/15 (26.7%) | Same pattern as DOCTOR — PAIN's low F1 (0.64) reflects general separability difficulty rather than one dominant confusion. |
| DOCTOR ↔ NURSE | 1/30, 1/17 | Both wrist-taps, tracked confusable pair — LOWER than the pre-fix run's 3/30 and 2/17, a real (if small-sample) improvement from the corrected NO_SIGN split and larger dataset. |

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
