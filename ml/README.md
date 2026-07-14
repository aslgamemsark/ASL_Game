# ML Recognition Pipeline (Phase C)

Trains an ASL Citizen word-classifier that runs **alongside** the rule verifier as a
**disambiguation layer** — it does not replace the per-parameter Sign Coach. See the Phase C
plan for the full rationale.

## Data flow (one extraction, many consumers)

```
video files ──▶ tools/extract_dataset.py ──▶ data/landmarks/<SIGN>/*.json   (Frame JSON)
                       │ 1€ filter, signer-split manifest
                       ▼
                data/manifest.csv
                       │
   ml/dataset.py ──▶ data/cache.npz   (X:(N,48,86)  y  split  classes)
                       │
   ml/inspect.py ──▶ ml/inspect_out/*.png   ◀── GATE: eyeball before training
                       │
   ml/train.py ───▶ ml/runs/model_vN/   (model.keras, tfjs/, confusion_matrix.png,
                       │                  metrics.json incl. minimal-pair report)
                       ▼
   web/src/engine/classifier.ts (C.5)   ◀── TF.js model, gated next to verify()
```

The `Frame` JSON is the **same format** the rule verifier, the confusor tests, the avatar
pipeline, and this trainer all read. Don't invent a second format.

## Local smoke test (no GPU, proves the code path)

```bash
# 1. extract landmarks from any folder where filename = sign
python -m tools.extract_dataset footage --src "D:/asl-synthesis/footage" --out data/landmarks
python -m tools.verify_extracted data/landmarks        # confirm rule engine reads it

# 2. build the cache
python -m ml.dataset --landmarks data/landmarks --manifest data/manifest.csv

# 3. GATE: render + health-check before training
python -m ml.inspect            # open ml/inspect_out/*.png, confirm each sign reads right

# 4. verify the training data path (no TensorFlow needed)
python -m ml.train --dry-run
```

## Real run on Kaggle (ASL Citizen)

1. Add the ASL Citizen dataset to a Kaggle notebook (Add Data).
2. Extract landmarks (resumable, multi-session if needed):
   ```bash
   python -m tools.extract_dataset dataset \
     --videos /kaggle/input/asl-citizen/videos \
     --labels /kaggle/input/asl-citizen/labels.csv \
     --col-file video_file --col-gloss gloss --col-signer participant_id \
     --out /kaggle/working/data/landmarks
   ```
   Extraction (CPU MediaPipe over 84k clips) is the real bottleneck — not GPU training.
3. `python -m ml.dataset --landmarks /kaggle/working/data/landmarks --manifest /kaggle/working/data/manifest.csv`
4. `python -m ml.inspect` — **do not skip the gate**.
5. `pip install tensorflowjs && python -m ml.train --epochs 60`
6. Download `ml/runs/model_vN/tfjs/` and wire it into the web app (C.5).

## Staging (decided in planning)

Smoke-test on the ~24 **game** signs first (fast, proves the pipeline), then scale to full
ASL Citizen with identical code. The full model's logits are mapped down to the game
vocabulary for the in-browser disambiguation gate.

## Multi-source data + NO_SIGN class (ML hardening pass, 2026-07)

The model previously only ever learned real signs — a closed-set classifier forced a confident
prediction for *some* known sign even on pure nonsense/idle motion, since softmax has no way to
say "this isn't a sign at all." Fixed by adding a NO_SIGN class trained alongside the real signs,
from three sources merged into one cache:

1. **Synthetic chaotic motion** (`tools/make_no_sign_synth.py`) — random-walk trajectories
   (varied speed, direction, location, non-sign handshape), unlike the confusor tests' clean
   sinusoidal negatives. Cheap, unlimited, no licensing. Regenerate with:
   ```bash
   python -m tools.make_no_sign_synth --count 400 --out data/synth_no_sign/landmarks
   ```
2. **HMDB51** (`tools/hmdb51_extract.py`) — a capped subset (default 50/class) of daily-action
   classes that plausibly resemble non-signing webcam behavior: brush_hair, wave, clap, drink,
   eat, talk, smile, chew, smoke. Sports/instrument/vehicle classes are never even opened —
   wrong domain. The dataset's original host (serre-lab.clps.brown.edu) has restructured since
   this was first researched; fetch it from the HuggingFace mirror instead:
   ```bash
   python -c "from huggingface_hub import hf_hub_download; \
     hf_hub_download(repo_id='jili5044/hmdb51', filename='hmdb51.zip', \
     repo_type='dataset', local_dir='data/hmdb51/raw')"
   python -m tools.hmdb51_extract --zip data/hmdb51/raw/hmdb51.zip --out data/hmdb51/landmarks
   ```
3. **Real app data** (consent-gated, not yet wired) — failed rule-verifier attempts where the ML
   vote (if active) also didn't confidently agree with the prompt. Deferred; see the ML
   hardening plan's Phase 4.5.

NTU RGB+D was in the original candidate list but is NOT used — it requires registering an
account and getting manual approval from ROSE Lab staff (not automatable). MS-ASL positive-data
clips (see below) hit the same YouTube-link-rot issue Kinetics-700 was already excluded for;
included anyway as a partial-yield attempt per an explicit decision to try it, not because the
fragility risk went away.

Target ratio: NO_SIGN class size ≈ sum of all real sign classes combined (a 50/50 "is this a
sign at all" balance at the class level) — not real-world prevalence, which would collapse the
model toward always predicting NO_SIGN. `web/src/engine/gate.ts` needed ZERO changes to support
this: its veto-only logic already treats any confident vote for a class other than the prompted
sign as a veto, and NO_SIGN is just another such class.

## MS-ASL (additional positive-data source)

Metadata-only, like WLASL (YouTube URL + start/end time in seconds, not raw video) — same
partial-yield situation, ~5+ years of potential link rot. Extraction groups instances by source
video (many MS-ASL videos contain multiple signs) so each video downloads once:
```bash
python -m tools.msasl_extract --zip data/ms_asl/MS-ASL.zip --out data/ms_asl/landmarks
```
Get `MS-ASL.zip` from the Microsoft Download Center download page (search "MS-ASL dataset
download microsoft") — the download link is dynamically generated per-session, so it can't be
hardcoded here.

## Cross-dataset validation (origin field)

`ml/dataset.py`'s cache now includes an `origin` array (one label per clip, derived from the
dataset root's own folder name: `asl_citizen`, `wlasl`, `ms_asl`, `hmdb51`, `synth_no_sign`).
Train on all-but-one origin and hold the remaining one out entirely as an extra test set — a
big accuracy drop there (vs. the normal held-out-signer split) means the model learned
dataset-specific shortcuts (framing/compression/watermarks) rather than the sign itself.

## Notes
- **Split by signer, not by video** — `extract_dataset.py dataset` does this in the manifest.
- **Augmentation** (`ml/augment.py`): rotation / scale / time-warp / jitter only. Horizontal
  mirroring is intentionally excluded (it corrupts handedness + orientation labels).
- Bulk outputs (`data/`, `ml/runs/`, `ml/inspect_out/`) are gitignored — regenerable.
