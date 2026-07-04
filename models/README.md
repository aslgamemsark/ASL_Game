# MediaPipe model files

The recognition engine uses the MediaPipe **Tasks API**, which loads `.task` model bundles.
These files are **not committed** (they're binary weights, git-ignored via `*.task`). Each
developer downloads them once into this folder.

## Required files

| File                        | Purpose                  | Download |
|-----------------------------|--------------------------|----------|
| `hand_landmarker.task`      | 21 landmarks per hand    | https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker#models |
| `pose_landmarker_lite.task` | body pose (shoulders for normalization) | https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#models |

The `_lite` pose model is enough — we only need the shoulder points for scale normalization.

## Optional file

| File                    | Purpose                                    | Download |
|--------------------------|---------------------------------------------|----------|
| `face_landmarker.task`   | 52 ARKit blendshape scores (non-manual markers — `core/schema.py`'s `NmmReq`) | https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models |

Only needed if you construct `Capture(want_face_blendshapes=True)` (off by default — no current
sign requires an NMM). Skip this download otherwise.

## Download commands (run from the repo root)

**Git Bash / macOS / Linux:**
```bash
curl -sSL -o models/hand_landmarker.task \
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
curl -sSL -o models/pose_landmarker_lite.task \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
# optional — only if you need face_blendshapes (see above)
curl -sSL -o models/face_landmarker.task \
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
```

**Windows PowerShell:**
```powershell
Invoke-WebRequest "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -OutFile models/hand_landmarker.task
Invoke-WebRequest "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" -OutFile models/pose_landmarker_lite.task
# optional — only if you need face_blendshapes (see above)
Invoke-WebRequest "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -OutFile models/face_landmarker.task
```

After downloading, this folder should contain (the `.task` files are git-ignored):

```
models/
├── README.md                 (committed)
├── hand_landmarker.task      (~7.8 MB, git-ignored)
└── pose_landmarker_lite.task (~5.8 MB, git-ignored)
```
