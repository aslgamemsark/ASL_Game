# ASL_Game

A gamified **American Sign Language (ASL)** learning app. The player is shown a prompt inside a
themed scenario (a coffee shop, a hospital, …) and must perform the correct ASL sign in front of
their webcam to progress.

## How recognition works (and the bug we refuse to repeat)

Every ASL sign is defined by five parameters: **handshape, location, movement, palm orientation,
non-manual markers**. Recognition is **rule-based geometry** over MediaPipe hand + pose
landmarks — this Python prototype has no ML model; the browser port (`web/`) additionally runs a
trained classifier, but strictly as a **veto-only disambiguation layer** on top of the same
rule-based checks, never a replacement for them.

The cardinal rule: **a sign that requires movement is never approved from a single frame.**
Movement is measured over a rolling ~1.5–2 second window of frames. (An earlier version passed
COFFEE for two motionless fists because it only inspected one frame — that class of bug is now
structurally prevented. See [CLAUDE.md](CLAUDE.md).)

## Project structure

```
ASL_Game/
├── core/            # SHARED recognition engine (never duplicated per scenario)
├── signs/           # sign definitions as data
├── scenarios/
│   ├── coffee_shop/   # Saad's themed scenario (presentation + assets only)
│   ├── hospital_shop/ # hospital scenario (see scenarios/hospital_shop/README.md)
│   └── classroom/     # classroom scenario (ownership not yet assigned)
├── tools/           # landmark fixture recorder + dataset extraction/vocab-mapping scripts
├── tests/           # confusor regression tests
├── ml/              # trained-classifier pipeline (dataset → inspect → train → deploy)
├── models/          # MediaPipe .task model files (downloaded, git-ignored)
├── web/             # the React/TypeScript port — same recognition schema, browser-side,
│                    #   with the trained classifier as an optional disambiguation layer
└── docs/            # architecture/handoff docs, plus docs/vault/ — an Obsidian-compatible
                     #   knowledge base (open docs/ as the vault); start at
                     #   docs/vault/00-Index.md
```

`core/` does recognition and is shared by every scenario. `scenarios/<name>/` only owns its
look (background, prompts, animations). This split is deliberate — see [CLAUDE.md](CLAUDE.md).

This README covers the **Python prototype** specifically. The browser port (`web/`) mirrors the
same five-parameter schema and confusor-test discipline — see `docs/vault/Architecture.md` for
how the two engines stay in sync, and `web/README.md` for running the web app itself.

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
   [models/README.md](models/README.md).

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
See [scenarios/hospital_shop/README.md](scenarios/hospital_shop/README.md) for how to perform each
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
[scenarios/hospital_shop/README.md](scenarios/hospital_shop/README.md).

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

## Roadmap

- **v1 (this Python prototype):** rule-based math, desktop, scenario by scenario. Still the
  source of truth for the sign schema — the browser port mirrors it, not the other way around.
- **Done:** ported recognition to the browser (`web/`, MediaPipe Tasks Vision / TypeScript);
  added a trained Bi-GRU classifier as a client-side, veto-only disambiguation layer
  (`ml/`, `web/src/engine/classifier.ts`) — see `docs/vault/ML-Pipeline.md`; added Supabase for
  user progress/auth/leaderboards (`web/`, not used for recognition).
- **Not yet built:** per-user calibration (a "make a fist" onboarding step to personalize
  handshape thresholds instead of global constants).
