---
type: moc
---

# Code Map — ML Pipeline (files, not narrative)

Narrative/why lives in [[ML-Pipeline]] and [[Decisions-Log]]; this note is just where the code and
data actually sit, for [[Code-Map]]'s file-level view.

## Datasets (local, extracted once — see `tools/extract_dataset.py`, `tools/wlasl_extract.py`)
- `data/asl_citizen/landmarks/<SIGN>/*.json` + `manifest.csv` — 20 signs, licensed dataset.
- `data/wlasl/landmarks/<SIGN>/*.json` + `manifest.csv` — 27 signs (some overlapping), C-UDA
  license — training/computational use only, see [[LICENSING_CHECKLIST]].
- `data/cache_merged.npz` — both datasets pre-baked into one numpy training cache
  (`ml/dataset.py` builds this: per-clip shoulder-normalized, 48-frame-resampled, 86-dim features).

## Training (`ml/`)
- `ml/dataset.py` — Frame JSON → numpy cache.
- `ml/augment.py` — rotation/scale/temporal-warp/jitter (never mirrors — would swap dominant hand).
- `ml/train.py` — Bi-GRU classifier trainer; tracks `CONFUSABLE_PAIRS` explicitly
  (DOCTOR/NURSE, COFFEE/YES, MEDICINE/DOCTOR, letter pairs — the same pairs
  [[Code-Map-Signs-Data|the 2026-07-06 calibration check]] confirmed are geometrically
  inseparable, independently, from real data).
- `ml/inspect.py`, `ml/eval_report.py` — dataset health gate + per-class metrics.
- `ml/runs/model_v4/` → exported to `web/public/models/signs/` (TF.js) — the model actually
  deployed in the app, loaded by `web/src/engine/classifier.ts`.

## Calibration (2026-07-06, separate from training)
- `tools/calibrate_from_dataset.py` — replays real dataset clips through the RULE verifier (not
  the classifier) to sanity-check `min_confidence` thresholds against real signers +
  known confusors. See [[Code-Map-Signs-Data]] for what it found.
- `tools/apply_calibration_to_ts.py` — mirrors any threshold change into
  `web/src/engine/signs/index.ts` so both engines stay in sync.
