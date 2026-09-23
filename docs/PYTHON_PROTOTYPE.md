# Python prototype and offline tools

The shipped application is the [web app](../web/README.md). This guide preserves the
Python setup, fixture recording and calibration workflow from the former root README.
Run these commands from the repository root. Live browser recognition fixes belong in
`web/src/engine/`; maintain Python parity when the offline pipeline is affected.

## Setup

1. Python **3.10+**.
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   # Windows:        .venv\Scripts\activate
   # macOS / Linux:  source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Download the MediaPipe Tasks model files (one-time) into `models/` — see
   [models/README.md](../models/README.md).

## Running

> Activate the venv and make sure the models are downloaded first.

**Play the coffee-shop scenario:**
```bash
python -m scenarios.coffee_shop.main            # play
python -m scenarios.coffee_shop.main --debug    # + live per-parameter score bars
```
A lesson of **3 levels / 12 signs** — Greetings (HELLO, PLEASE, THANK YOU, YOU), Cafe Order
(COFFEE, WANT, YES), Fingerspelling (A, B, L, V, Y). Each correct sign earns **+10**; finish a
level for a level-complete card, then the next, ending in a total-score summary. Press `r` to
replay, `q` to quit.

**Play the hospital scenario:**
```bash
python -m scenarios.hospital_shop.main          # play
python -m scenarios.hospital_shop.main --debug  # + live per-parameter score bars
```
Treat a queue of patients — **HELP, PAIN, MEDICINE, EMERGENCY**. Keys: `q` quit, `n` next patient.
See [scenarios/hospital_shop/README.md](../scenarios/hospital_shop/README.md) for how to perform each
sign and the edge-case test framework.

**Dev tools:**
```bash
python -m tools.demo_landmarks                  # raw landmarks + inter-hand distance
python -m tools.demo_verify --sign COFFEE       # live per-parameter verifier scorecard
python -m tools.record_fixture --name <name> --sign COFFEE   # record a JSON fixture
```

## Tests

```bash
pytest                       # or: pytest tests/test_coffee.py -v
```
Each sign ships a **correct** fixture and a **confusor** (the likeliest false positive). The
confusor must fail on the *right* parameter — that's the regression lock against the single-frame
bug. The hospital signs additionally ship an **idle** fixture (hands present but not performing the
sign) that must fail on movement — the lock against false positives. See
[scenarios/hospital_shop/README.md](../scenarios/hospital_shop/README.md).

## Adding a new sign (safe workflow)

1. **Define it** in `signs/<name>.py`, marking **every** parameter the sign requires. The schema
   refuses to let you declare a movement and leave it unenforced (try it — `Sign.__post_init__`
   raises). Register it in `signs/__init__.py`.
2. **Record fixtures** — a correct one and a confusor:
   ```bash
   python -m tools.record_fixture --name <sign>_correct  --sign <SIGN>
   python -m tools.record_fixture --name <sign>_confusor --sign <SIGN>
   ```
3. **Calibrate live** with `python -m tools.demo_verify --sign <SIGN>` — watch the bars and the
   movement readout, then tune the sign's thresholds (see below).
4. **Add a test** asserting correct → PASS and confusor → FAIL on the right parameter.
5. **Run the pre-ship checklist** (below) before merging.
6. If the sign shares a handshape/location with an existing one (a **minimal pair**), flag it —
   that's where rule-based detection gets fragile and is the signal it may be time for ML.

## Where the tuning knobs live

All recognition tuning is **per-sign data** in `signs/<name>.py` — never buried in the engine:

| Knob | Field (in the sign's `MovementReq` / `LocationReq` / `HandShapeReq`) | What it does |
|------|------|------|
| Rotation needed | `min_total_rotation_deg` (COFFEE: 360) | how much circling counts as a grind |
| Circle messiness allowed | `radius_tolerance_ratio` (COFFEE: 1.0) | how irregular a real circle can be |
| Lift distance (linear) | `min_displacement_ratio` (HELP: 0.15) | min directed travel for a linear move |
| Hands-closing (converge) | `min_approach_ratio` (PAIN: 0.15) | how far the inter-hand gap must shrink |
| Oscillations (repeated) | `min_cycles` (MEDICINE: 2, EMERGENCY: 3) | back-and-forth cycles for a repeated move |
| Hands-together distance | `LocationReq.max_dist_ratio` (COFFEE: 0.9) | max gap between hands (shoulder-widths) |
| Per-parameter pass bar | `min_confidence` (default 0.6) | threshold each parameter must clear |

Engine-level shared constants live in `core/` (e.g. `_RADIUS_CV_FREE` in `core/movement.py`,
`SMOOTH_SECONDS` in `core/verifier.py`) — change these only deliberately; they affect every sign.

## Robustness notes

- **`HandStabilizer`** (`core/landmarks.py`) carries a recently-seen hand forward for ~0.3s to
  bridge brief MediaPipe dropouts (closed fists are its weak spot). Used in live play, **not** in
  the recorder (fixtures stay raw).
- **Lighting / camera** quality matters more than any threshold — a missing landmark can't be
  recovered by rules *or* ML. Good light + hands fully in frame is the cheapest robustness win.
- **Next robustness lever (not yet built):** a per-user calibration step ("make a fist") to
  personalize handshape thresholds instead of global constants.

## Pre-ship checklist (run before merging any new sign)

1. Does the definition mark **every** parameter the sign requires — not just handshape/location
   if movement matters?
2. Does movement use the **rolling buffer** (multiple frames), never a single frame?
3. Show the **confusor** fixture failing, and confirm **which** parameter caused the fail.
4. Show the **correct** fixture passing.
5. `pytest` green.
