# ML training pipeline

The trained classifier (`web/public/models/signs/`) is a **veto-only disambiguation layer**
(`web/src/engine/gate.ts`) — it never rescues a rule-failed attempt, it can only veto an
already-rule-passed one when confident the user signed something else. Rules + the per-parameter
Sign Coach remain the primary recognition path.

## Data sources
- **ASL Citizen** (`data/asl_citizen/`) — licensed for research/training. `tools/asl_citizen_vocab.py`'s
  `GAME_VOCAB` maps its native glosses (with sense numbers, e.g. `WANT1`/`WANT2`) to game sign ids.
  ⚠️ The raw source annotation file (with the FULL gloss vocabulary) is **not kept locally** after
  extraction — only the already-extracted `data/asl_citizen/manifest.csv` (post-mapping) persists.
  To verify a new gloss exists in ASL Citizen, you need the raw `ASL_Citizen/splits/*.csv` from a
  fresh extraction — don't assume a sign is absent just because `manifest.csv` doesn't have it yet.
- **WLASL** (`data/wlasl/`) — non-commercial/research license, user-authorized 2026-06-30. Its
  metadata file **`data/wlasl/WLASL_v0.3.json` is kept locally** (lightweight, no video) — this is
  the reliable way to check gloss existence: `json.load(...)`, filter by `entry["gloss"]`. Expect
  significant source-video attrition (dead YouTube links etc. — MORE lost 6/15, budget for it).

## Pipeline
`tools/extract_dataset.py` (ASL Citizen) / `tools/wlasl_extract.py` (WLASL, resumable — skips
clips already extracted) → `data/*/manifest.csv` → `ml/dataset.py` (merges multiple landmark
roots+manifests, classes auto-derived from `sorted(set(raw_labels))`) → `ml/inspect.py`
(**mandatory visual gate, do not skip**) → `ml/train.py` (Bi-GRU, `reset_after=False` required
for TF.js compatibility, versioned `ml/runs/model_vN/`) → `ml/sanitize_tfjs.py` (strips
regularizer configs TF.js's LayersModel rejects — confirmed NOT a no-op, actually nulls entries)
→ copy `tfjs/{model.json,*.bin}` + `classes.json` into `web/public/models/signs/`.

## Environments
`.venv` (Python 3.14: cv2/mediapipe/yt_dlp/requests — capture/extraction) vs `.venv-ml` (Python
3.11: TensorFlow 2.21.0 + tensorflowjs — dataset/inspect/train/eval).

## Model history
- `model_v4` — 18 signs (before MORE).
- `model_v5` — 19 signs, added MORE, 83.6% test accuracy.
- `model_v6` — 24 signs, added TEACHER/WRITE/READ/NAME/FRIEND, 82.6% test accuracy. WLASL-only
  (not verified in ASL Citizen — see the caveat above). Deployed to `web/public/models/signs/`.
  Full detail: [[Workstream-A-Classroom]].

## Known dev-server limitation
The TF.js classifier fails to load under `npm run dev` (`@tensorflow/tfjs unavailable`) — always
verify classifier-dependent behavior under `npm run build && npm run preview` instead.
