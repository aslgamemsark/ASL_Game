# Real-World Data Collection Review

*Generated 2026-07-14. Every claim below is sourced from the actual codebase at this commit
(paths and line numbers cited) or explicitly marked as "not implemented" / "not measured" — nothing
in this report is estimated or assumed. See [MODEL_STATUS.md](MODEL_STATUS.md) for the model-training
side of the picture; this report covers the real-user telemetry pipeline that would feed future
retraining.*

## 0. What actually exists today (ground truth)

- **Backend**: a real, active Supabase/Postgres backend (`supabase/schema.sql` + 12 migrations,
  `20260701235816` → `20260712140000`) — not a local-only prototype.
- **Consent**: `collectTrainingData` in `useUserStore.ts` (default **`true`**, i.e. opt-out), backed
  by a one-time forced consent modal (`AuthContext.tsx`'s `needsTrainingConsent` /
  `dismissTrainingConsent`) and a Settings → Privacy toggle (`SettingsPage.tsx:109-134`).
- **Attempt logging**: every lesson/practice/story/speed attempt calls `logAttempt()`
  (`useProgressSync.ts:259-286`), which always writes a lightweight row to `sign_attempts`
  (`user_id, sign_id, passed, rule_passed, ai_prediction, ai_confidence, ai_vetoed`) and,
  **only if consent is on and frames are non-empty**, additionally writes the full landmark
  sequence to `training_samples` (`user_id, sign_id, frames jsonb, rule_passed, ai_prediction,
  ai_confidence, final_passed, source, created_at`).
- **Per-parameter rule scores**: `sign_verification_log` (`param_scores jsonb`,
  `classifier_vote jsonb`) — deliberately **excludes** raw frames (comment at
  `useProgressSync.ts:223-224`), so this table is useful for debugging *why* a sign failed but not
  for retraining directly.
- **Identity**: no anonymization layer anywhere — every table is keyed by the real Supabase
  `auth.users` UUID, which is also the FK to `profiles` (containing the user's chosen username).

This is a materially real pipeline, not vaporware — the honest starting point for this review is
"a working opt-out consent + landmark-capture system exists," not "nothing exists."

---

## 1. Are we collecting enough landmark data for future model improvements?

**Volume: not yet measurable, and likely still small.** There is no query in this repo that
reports how many rows currently exist in `training_samples` — that number lives in the production
database, not in code, and this review can't fabricate it. Structurally, though, the collection
rate is capped by real usage: `logAttempt` only fires on a completed attempt inside Lesson/Practice/
Story/Speed pages, so volume scales directly with DAU × attempts/session, not with anything the
codebase can accelerate on its own.

**Content: missing the two things that matter most for closing the generalization gap.**
1. No **model version** is stored per sample (`grep` for `model_version`/`modelVersion` across
   `web/src` returns zero matches). Every future retraining run pools all historical
   `training_samples` rows into one training run with no way to tell whether a given clip's
   `ai_prediction`/`ai_confidence` came from `model_v6`, `model_v7`, or a rule-only session with no
   classifier loaded at all.
2. No **device/browser/camera metadata** is captured anywhere (`useCamera.ts:27-30` requests
   `getUserMedia` with a fixed ideal 640×480 and never reads back the *actual* negotiated
   resolution, frame rate, or device label; no `navigator.userAgent`/browser/OS capture exists in
   `web/src` at all). This is exactly the axis the cross-dataset holdout test showed the model is
   weak on (Section 2) — training data that all looks like "whatever `getUserMedia` defaults to on
   whatever camera happened to be plugged in" doesn't diversify the model against different optics.

**Verdict**: the plumbing to collect is there; the *content* of what's collected is not yet rich
enough to reliably improve generalization, only to grow raw example count for signs that are
already well-represented in ASL Citizen/WLASL/MS-ASL.

---

## 2. Does the current strategy reduce the 41.4% cross-dataset holdout gap?

**Not on its own, and this is the single most important finding in this report.**

The 74.2% → 41.4% drop (documented in `docs/MODEL_STATUS.md`) was caused by holding out an entire
*data source* (MS-ASL) — i.e., the model partly learned source-specific artifacts (camera,
compression, framing conventions common to one dataset) rather than purely the sign itself. Real
user data is genuinely valuable here **only if it's genuinely diverse across users' own
setups** — different webcams, rooms, lighting, distances from camera. Today:

- There's no way to tell two `training_samples` rows apart by device/camera/lighting, so a
  retraining run can't even measure whether it added diversity, let alone whether that diversity
  is why accuracy improved.
- There's no per-sample **origin tag** analogous to the `origin` field already added to
  `ml/dataset.py`/`cache.npz` for the academic datasets (see `docs/ml_reports/`) — real user data
  has no equivalent marker distinguishing "this device/session" from another, so cross-*condition*
  holdout evaluation (the same technique that surfaced the 41.4% number) can't be run on real-user
  data at all yet.
- Volume matters too: per Section 7 below, a handful of hundred real samples pooled in with ~2,200
  academic clips will barely move the needle numerically, even before considering diversity.

**Recommendation**: add a coarse, privacy-safe environment fingerprint per sample (see Section 3)
specifically so a future retraining run can (a) confirm real data actually added variety and (b)
run the same holdout-by-source technique against "real users" as its own origin bucket, the same
way `wlasl`/`ms_asl`/`asl_citizen` are treated today.

---

## 3. What metadata should be stored alongside every landmark sequence?

Going through the user's example list against what's actually stored today:

| Field | Status today | Recommendation |
|---|---|---|
| expected sign | ✅ `sign_id` | keep |
| predicted sign | ✅ `ai_prediction` | keep |
| confidence | ✅ `ai_confidence` | keep |
| rule verifier output | ⚠️ partial — `rule_passed` (bool) in `training_samples`; full `param_scores` only in the separate `sign_verification_log` table (no frames), not joined | **join or duplicate `param_scores` into `training_samples`** — per-parameter scores (handshape/location/movement/orientation/NMM) are exactly what tells you *which* parameter a failed attempt was weak on, the highest-value debugging signal for error analysis |
| pass/fail reason | ⚠️ `final_passed`/`rule_passed`/`ai_vetoed` flags exist but no structured "reason code" | add a `fail_reason` enum (`rule_reject`, `ai_veto`, `pass`) — currently reconstructable from the three booleans but not stored as one queryable field |
| camera FPS | ❌ not found anywhere | **add** — actual negotiated FPS from the `MediaStreamTrack.getSettings()` API (trivial to read, not currently read at all) |
| browser | ❌ not found | **add** — `navigator.userAgent` parsed to browser family only (never raw UA string — see privacy note below) |
| device type | ❌ not found | **add** — coarse only: mobile/desktop via `navigator.userAgentData` or viewport heuristic |
| webcam resolution | ❌ requested resolution is hardcoded ideal 640×480, actual negotiated resolution never read back | **add** — `MediaStreamTrack.getSettings().width/height` |
| handedness | ✅ present per-hand in `Frame.hands[].handedness`, already stored inside `frames jsonb` | keep (already fine — it's inside the blob, not a top-level column, so it's not separately queryable without unpacking JSON; consider promoting `dominant_hand` to a top-level column for cheap left-handed-user analysis, see [MODEL_STATUS.md](MODEL_STATUS.md) Known Issue #1) |
| landmark visibility/confidence | ❌ **not captured at all** — `Hand` (`web/src/engine/landmarks.ts:24-27`) stores only `handedness` and `points: number[][]` (21×3 coordinates), no per-point confidence/visibility despite MediaPipe Tasks API making this available | **add** — MediaPipe's `HandLandmarkerResult` does expose per-landmark presence/visibility scores; not currently threaded through `Capture` at all. This is a real, fixable gap — occlusion-quality is one of the most useful signals for identifying hard/valuable samples (Section 5) |
| lighting quality | ❌ not found; no proxy exists either (no average frame brightness, no exposure reading) | **add a cheap proxy**: average luma of the hand bounding-box region per frame, computed client-side from the existing canvas frame — doesn't require storing video, just one float per frame or per clip |
| timestamp | ⚠️ partial — `created_at`/`attempted_at` (row-insert wall-clock time) exists; per-frame relative time `Frame.t` exists inside the blob; but no explicit `session_started_at` distinguishing "this was attempt #1 of a 20-minute session" from "this was a cold start" | row timestamp is enough for most purposes; a `session_id` (below) matters more than more timestamp granularity |
| model version | ❌ **not found anywhere** — the single highest-priority addition | **add `model_version text`** column, populated from a constant already available client-side (`web/src/config/classifier.ts`'s model path/version) at the moment `logAttempt` fires |
| session ID | ❌ **not found anywhere** (explicit grep for `sessionId`/`deviceId`/`anonId` returns nothing) | **add** — a random UUID generated once per app load (not tied to auth), stored to correlate "these 8 attempts happened in the same sitting" without needing anything privacy-sensitive |
| anonymized user ID | ❌ **not implemented** — every table uses the real `auth.users` UUID directly, which FKs to `profiles.username` | see privacy discussion below — the current design is a genuine future risk, not just a missing nice-to-have |
| retry count | ❌ not found | **add** — trivial client-side counter: how many attempts at *this sign* in *this session* before this one passed. Distinguishes "got it first try" from "failed 6 times then passed on a technicality" — the latter is a much higher-value training sample |
| user confirmed prediction | ❌ no UI anywhere asks the user "was this right?" | see Section 5 — this is the single biggest missing piece for turning ambiguous/low-confidence samples into *trusted* labels rather than auto-labeled guesses |
| user corrected prediction | ❌ not implemented | same as above |
| sequence duration | ⚠️ derivable from `frames.length`/`Frame.t` inside the JSONB blob, not a top-level column | promote to a `duration_ms` column — cheap, makes filtering/aggregation not require unpacking JSON |
| inference latency | ❌ not found — no timing instrumentation around the classifier call in `gate.ts`/`useRecognition.ts` was located | **add** — wrap the TF.js `model.predict()` call with `performance.now()` before/after, store `inference_ms` |

**Additional metadata not in the user's list, worth adding:**
- **App version / build hash** — so a schema or feature-extraction change (like the
  `sequenceFeatures.ts` bug fixed this session) can be correlated with a spike in failed attempts
  after a deploy, rather than only visible after someone notices complaints.
- **Prompt-to-first-motion latency** — how long after the sign was prompted did the user's hand
  first start moving; distinguishes hesitant/uncertain users from confident ones, another proxy
  for sample difficulty.
- **Whether the classifier was even loaded this session** — `GATE_EXCLUDED_SIGNS` and the "classifier
  off under `npm run dev`" note in project memory mean `ai_prediction`/`ai_confidence` can be
  legitimately null for reasons unrelated to the sign itself; a `classifier_active boolean` avoids
  conflating "no classifier ran" with "classifier ran and returned null."

---

## 4. Production data collection pipeline design

The user's sketch is directionally right; the concrete version, mapped onto what already exists
vs. what's missing:

```
Webcam capture (useCamera.ts)
        │  [MISSING: read back actual resolution/FPS via getSettings()]
        ▼
Landmark extraction (Capture / MediaPipe Tasks API)
        │  [MISSING: per-landmark visibility/presence threaded into Frame]
        ▼
Rolling buffer → rule verifier (verifier.ts) → per-parameter scores
        │
        ▼
ML gate (gate.ts: gatePass) → prediction + confidence + veto decision
        │  [MISSING: inference_ms timing captured here]
        ▼
Attempt outcome shown to user
        │  [MISSING ENTIRELY: no "was this right?" confirm/correct UI step exists today —
        │   see Section 5. This is the biggest structural gap in the whole pipeline.]
        ▼
Consent check (collectTrainingData, already implemented, default-on)
        │
        ▼
logAttempt() — writes sign_attempts (always) + training_samples (if consent + frames)
        │  [MISSING: model_version, session_id, device/camera/lighting metadata,
        │   retry_count, confirmed/corrected fields — none of these exist as columns today]
        ▼
Supabase Postgres (RLS: owner-only read on training_samples — already correctly scoped)
        │
        ▼  ← EVERYTHING BELOW THIS LINE DOES NOT EXIST YET, AT ALL
        ▼
[MISSING] Automated quality validation (reject corrupt/too-short/no-hands-visible clips
           before they ever reach a "trusted" pool)
        ▼
[MISSING] Review queue (surfacing dual-reject cases — rule failed AND classifier disagreed —
           for a human to spot-check before trusting the NO_SIGN auto-label, exactly as already
           specified for synthetic/HMDB51 data in the earlier ML hardening plan §4.5, but never
           built for real user data specifically)
        ▼
[MISSING] Dataset versioning (a `data/real_user_manifest_vN.csv` snapshot mechanism,
           mirroring the existing `ml/runs/model_vN/` convention, so a training run's exact
           real-data composition is reproducible/auditable later)
        ▼
[MISSING] Retraining trigger (currently 100% manual — `python -m ml.train` run by a person;
           no threshold-based "N new high-value samples accumulated, suggest retraining" signal)
        ▼
[MISSING] Model evaluation gate before deploy (no automated check comparing a new model's
           metrics.json against the currently-deployed model's before the "Deploy model_vN"
           commit convention is used — deployment is a manual file copy + commit today)
        ▼
Deployment (web/public/models/signs/, versioned by commit message convention introduced
           2026-07-14 — manual, works, but has no automated regression gate)
```

**Bottom line**: the top half of this pipeline (capture → consent → storage) is real and
functional. The bottom half (quality gate → review queue → versioning → retraining trigger →
evaluation gate) is **entirely unbuilt** — every box below the RLS-scoped Postgres write is a
recommendation, not a description of existing code.

---

## 5. Automatically identifying "high-value" samples

None of this exists today — no query, view, or scheduled job in the repo ranks or flags samples.
Recommended prioritization logic, buildable directly on columns already available (plus the
Section 3 additions) in `training_samples`:

**Should be prioritized:**
- **Disagreement cases** (`rule_passed != (ai_prediction == sign_id)`) — the rule verifier and
  classifier disagreeing is definitionally where the model is uncertain; this is the same
  dual-rejection logic already specified for NO_SIGN auto-labeling and generalizes directly to
  "review this."
- **Low-confidence passes** (`final_passed = true AND ai_confidence < 0.5`) — passed, but the
  model wasn't sure; likely represents legitimate sign variation the training set underrepresents.
- **High retry-count passes** (needs the Section 3 `retry_count` field) — a sign passed on attempt
  6 is informative about what *doesn't* work, not just what does; today this signal is thrown away
  entirely since retry count isn't tracked.
- **Left-handed users** — derivable today from unpacking `frames[0].hands[].handedness` +
  `assignRoles()` logic, but not pre-computed into a queryable column; per
  [MODEL_STATUS.md](MODEL_STATUS.md) Known Issue #1 this was a real, previously-shipped bug class,
  so left-handed samples are disproportionately valuable for regression-testing that fix.
- **New device/camera fingerprints** (needs Section 3's device metadata) — the first N samples
  from a never-seen resolution/FPS combination are exactly the kind of distributional diversity
  that Section 2 identifies as missing.
- **Partially-occluded hands** — needs the Section 3 visibility/presence field; without it, this
  category literally cannot be identified today.

**Should NOT be blindly prioritized:** unusual hand proportions alone, without a corroborating
signal (disagreement or low confidence), risk conflating "unusual hand" with "bad landmark
extraction" — needs a human review step, not automatic inclusion.

**Mechanism**: this is a natural SQL view (`high_value_training_samples`), analogous to the
existing `ai_veto_stats`/`most_failed_signs` views in `schema.sql` — the pattern already exists in
this codebase, it just hasn't been extended to this purpose.

---

## 6. Comparison to production ML best practices

| Approach | What it means | Where this project sits |
|---|---|---|
| **Active learning** (query the model for its most uncertain cases, prioritize labeling those) | Uses model confidence to direct data collection effort | **Partially aligned in spirit, not in practice.** The `ai_confidence` field exists and *could* drive this, but nothing currently queries it to select samples for review — Section 5's design would close this gap directly. |
| **Continual/online learning** (incrementally update the model as new data arrives, without full retraining from scratch) | Not attempted and likely **not appropriate here yet** — with an estimated few-hundred to low-thousands of real samples (Section 7), incremental fine-tuning risks catastrophic forgetting on a model this small (105K params) trained on this little data. Full retraining from a versioned snapshot (current approach) is the right call at this data scale. | Correctly *not* implemented — this would be over-engineering at current volume. |
| **Human-in-the-loop** (humans validate/correct model outputs before they become training labels) | The `sign_verification_log` table + per-parameter scores gives the *raw material* for this, but there is no reviewer-facing UI or workflow anywhere in the repo. | **Not implemented.** This is the single most impactful gap relative to best practice — every academic negative-data source in this project (HMDB51, synthetic, MS-ASL) went through manual verification before being trusted; real user data has no equivalent gate before landing in `training_samples`. |
| **Data-centric AI** (treat data quality/curation as the primary lever, not just architecture) | The existing `ml/dataset.py` origin-tracking, dedup-detection, and per-class balance auditing (documented in `docs/ml_reports/`) already reflect this mindset for academic data. | **Well-aligned for academic data, not yet extended to real user data** — no dedup, no per-class balance tracking, no origin/diversity tracking exists for `training_samples` today. |

**Overall**: the project's *academic*-data pipeline (this session's earlier work) already reflects
solid data-centric practices. The *real-user* pipeline, by contrast, currently amounts to "collect
everything with consent, store it raw" — a reasonable MVP, but it stops well short of the
active-learning/human-in-the-loop patterns that would make that data reliably useful for
retraining rather than just accumulating.

---

## 7. How many real samples before retraining helps?

**Framed honestly: these are order-of-magnitude engineering estimates grounded in the current
training run's own numbers, not measured outcomes — no real-user retraining run has happened yet
to confirm them.**

The current model was trained on **2,197 clips across 25 classes** (~88 clips/class average, but
very uneven — ASL Citizen alone contributes up to ~36/class while several classes sit near the
12-clip EMERGENCY floor per [MODEL_STATUS.md](MODEL_STATUS.md)). Given that baseline:

- **~500 real samples**: spread over 24 signs, that's ~20/sign — **too thin to meaningfully move
  accuracy on its own**, but if concentrated on the specific signs with the worst error rate today
  (HELLO's elevated false-rejection rate, or the 8 signs flagged for recalibration) could measurably
  improve *those specific signs* without changing the aggregate number much. Value here is
  diagnostic (Section 5's review queue) more than statistical.
- **~5,000 real samples**: roughly **2-3x today's total dataset size**, and — critically — from a
  genuinely different distribution (real webcams, real rooms) than the academic sources. This is
  the range where I'd expect a *measurable* dent in the cross-dataset generalization gap
  (Section 2), plausibly narrowing some fraction of the 74.2%→41.4% gap, precisely because it adds
  distributional diversity the academic sources structurally can't. No specific percentage-point
  estimate is honest to give without running the experiment.
- **~50,000 real samples**: at this scale, real-user data would **dominate** the training set
  numerically (>20x the current academic corpus) and the earlier academic-vs-real balance decisions
  in `ml/train.py` (class weighting, augmentation ratios) would need revisiting — this is the point
  where a from-scratch architecture reconsideration (Section 4.6 of the earlier ML hardening plan —
  TCN/Transformer becoming viable given real data volume) is worth revisiting, not before.

**The realistic bottleneck isn't the number — it's Section 6's missing human-in-the-loop gate.**
50,000 *unreviewed* real samples inheriting whatever labeling mistakes or edge-case ambiguity
slipped through is worse than 5,000 *reviewed* ones. Build the review queue before optimizing for
volume.

---

## 8. Database schema future-proofing review

Reviewed: `supabase/schema.sql` + all 12 migration files.

**What's already good:**
- RLS is applied per-table with sensible defaults (owner-only on `training_samples`/
  `sign_verification_log`, public-read on leaderboard/progress views) — this is exactly the
  posture you want before public launch, already done.
- The migration-file convention (timestamped, additive) is a normal, sound schema-evolution
  pattern — no destructive migrations were found in this review.
- `frames jsonb` for landmark storage is the right call at this stage — schema-flexible for a
  format (`Frame`) that's still evolving (it grew `faceBlendshapes` as an additive optional field
  this session per `landmarks.ts:51-55`'s own comment).

**What's missing before this scales to "several years of model development":**
1. **No `model_version` column anywhere** (repeated from Section 3 — this is the most
   consequential single gap; without it, historical `training_samples` rows become progressively
   less interpretable as the classifier evolves, since you can't tell which model's predictions
   you're looking at).
2. **No `schema_version`/`feature_version` marker on `training_samples`** — if
   `sequenceFeatures.ts` (the exact file with this session's critical bug) changes again, old
   stored `frames` blobs need to be re-processed through whichever feature-extraction version was
   current when they were captured. Without a version marker, a future engineer has no way to know
   which extraction logic applied to old rows.
3. **No dedup mechanism at the database level** — the academic pipeline now hashes landmark
   sequences to catch duplicates (`tools/generate_ml_report.py`'s `_clip_hash`); nothing analogous
   exists for `training_samples`, so one user replaying the same lesson repeatedly could
   silently dominate a sign's real-data pool.
4. **No retention/deletion policy encoded in schema** — `training_samples` has no `expires_at` or
   equivalent, and no code path was found that lets a user request deletion of their own stored
   landmark data specifically (as distinct from general account deletion, which wasn't reviewed
   here). Given `frames jsonb` is keyed directly to a real user UUID (Section 3's privacy note),
   this matters for eventual compliance (GDPR-style "right to erasure") even though the current
   audience is presumably small.
5. **Identity coupling is a real risk, not just a schema nicety.** Every training-relevant table
   uses the same UUID that identifies a person's public username and (via `auth.users`) email.
   There is no pseudonymization layer separating "a training sample" from "a specific, identifiable
   person's account." Before wider public release, consider either (a) a separate anonymous
   `training_subject_id` generated once per user specifically for ML tables, decoupled from
   `profiles`, or (b) explicit, prominent disclosure that landmark data is tied to account identity
   (today's Settings copy says data collection can be toggled off, but does not say it's
   identity-linked rather than anonymous — this is a disclosure gap, not just a technical one).

**Recommended schema additions** (additive migration, non-breaking):
```sql
alter table public.training_samples
  add column model_version text,
  add column feature_schema_version text,
  add column session_id uuid,
  add column device_type text,
  add column browser text,
  add column camera_width int,
  add column camera_height int,
  add column camera_fps numeric,
  add column avg_luma numeric,
  add column retry_count int,
  add column duration_ms int,
  add column inference_ms numeric,
  add column user_confirmed boolean,
  add column landmark_hash text;  -- for dedup, mirrors tools/generate_ml_report.py's _clip_hash
create index on public.training_samples (landmark_hash);
create index on public.training_samples (model_version);
```

---

## Overall score: 5/10

**What the score reflects**: a genuinely working, consented, correctly-RLS-scoped landmark
collection pipeline exists — that's real infrastructure, not a stub, and puts this ahead of "we
collect nothing." The score is held down by three specific, fixable gaps rather than by anything
architecturally wrong:

1. **No model/feature versioning on stored data** (Section 3, 8) — the single highest-priority fix,
   cheap to add, and every day it's not there is more historical data that becomes ambiguous later.
2. **No human-in-the-loop review step between "collected" and "trusted for training"** (Section 4,
   6) — the biggest structural gap; without it, volume growth doesn't translate to reliable
   improvement.
3. **No device/camera/environment diversity signal** (Section 1, 2, 3) — without this, there's no
   way to confirm real user data is actually closing the cross-dataset generalization gap that
   motivated this whole review, even after the other two gaps are fixed.

None of these require a redesign — they're additive columns and one new UI flow (confirm/correct)
on top of a pipeline that already works. Fixing items 1 and 3 is a small, low-risk change (schema
migration + a few client-side reads that are already available via browser APIs). Item 2 is the
larger effort — a review queue UI/workflow — and is the right thing to prioritize before volume,
per Section 7.
