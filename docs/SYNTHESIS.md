# Procedural ASL Avatar Synthesis (the expressive side)

The recognition engine answers *"did the learner sign this correctly?"* This module answers the
mirror question — *"show the learner what this sign looks like"* — by **procedurally generating** the
sign from the **same `Sign` schema** the verifier uses. It is the deterministic, calibration-driven
pipeline described in *Procedural Synthesis of American Sign Language Avatars*, implemented in the
project's current Python stack so it can be proven correct today and ported to browser Three.js later.

> **Why this matters:** the report's cardinal rule is **no bilateral error**. Because synthesis and
> recognition read one schema, a sign animated from that schema must be *recognized* by the verifier
> built from it — and a frozen copy of a movement sign must be *rejected*. We turned that into an
> automated test (`tests/test_synthesis.py`): the schema is proven correct in **both** directions
> before any clip ships. No dataset, no loss function, no backpropagation — just math plus a
> human-in-the-loop calibration gate.

## What was built (and where the report's phases live)

| Report phase | Module | What it does |
|---|---|---|
| 1 — Rigging (deferred) | `core/synthesis.py` `Body` | A canonical stick-rig (shoulders, mouth, scale). A real glTF/GLB avatar is **deferred** per the report's Phase-9 reality check; this rig is enough to prove the math. |
| **2 — Handshape presets** | `core/handshape_presets.py` | Finite, one-time library mapping each handshape name → canonical 21-landmark pose. The literal inverse of `core/handshape.py`; presets score ≥ threshold under the recognition predicates. |
| **3 — Trajectory generators** | `core/trajectory.py` | Sine/cubic easing + linear, circular/arc, oscillatory, and converge curve generators, driven by the schema's `MovementReq`. The inverse of `core/movement.py`: it *generates* the rotation/displacement/cycles that module *measures*. |
| **4 — Analytical 2-bone IK** | `core/ik.py` | Closed-form Law-of-Cosines solver with elbow pole vector and reach clamping. Exact, single-pass, deterministic — no popping, no per-frame jitter. |
| **5 — Sign assembly script** | `core/synthesis.py` `synthesize()` | Compiler: handshape lookup → body-relative anchor resolution (reusing the verifier's anchor constants) → trajectory generation → per-frame assembly into timestamped `Frame`s. |
| **6 — Calibration gate** | `core/calibration.py` | `self_verify()` (automated bilateral gate) + a persisted `CalibrationLog` checklist (verifier / reviewed / approved / notes). A clip ships only when `verifier_passed AND avatar_approved`. |
| 6/9 — Calibration GUI / reference slot | `core/render.py`, `tools/synthesize_demo.py` | Stylized 2D skeletal renderer → animated-GIF reference clips (arms placed by the Phase-4 IK), the medium-agnostic "watch the reference" slot of the lesson loop. |
| 7 — Case study | the registry | Every registered sign (COFFEE, PLEASE, THANK-YOU, the fingerspelling set, the hospital set …) is synthesized and round-tripped, not just one. |
| 8 — Non-manual markers | *deferred* | Facial grammar (blendshapes) is intentionally **not** built yet — exactly the report's strategic deferral to avoid the uncanny valley before the hands are solid. |

## Try it

```bash
# MP4 reference clips for every registered sign + run the calibration gate (default format: mp4)
python -m tools.synthesize_demo

# test ONE word with the verifier scorecard burned in (per-parameter bars + PASS/FAIL):
python -m tools.synthesize_demo COFFEE --scores

# also render the frozen "confusor" so you can see movement go red/FAIL on a held pose:
python -m tools.synthesize_demo COFFEE --scores --static

# animated GIFs instead of (or alongside) MP4; calibration table only:
python -m tools.synthesize_demo --format gif        # or --format both
python -m tools.synthesize_demo --no-gif
```

Useful flags: `--scores` overlays the verifier readout, `--speed 0.5` plays at half speed (default),
`--repeats 3` loops the clip in the MP4, `--static` adds the frozen confusor clip. Clips land in
`reference_clips/<SIGN>.mp4` (scrub/pause in any player) and the checklist in `calibration_log.json`
(both git-ignored — regenerate any time). Tests:

```bash
pytest tests/test_synthesis.py -v
```

## How it stays correct (the bilateral guard)

```
        Sign schema (signs/*.py, core/schema.py)
                 │                     │
     synthesize()│                     │ verify()
                 ▼                     ▼
   synthetic Frames  ───────────►  per-parameter scores
                       must PASS
   static(frozen)  ───────────►   must FAIL on movement
```

`tests/test_synthesis.py` runs both arrows for every registered sign. If anyone later weakens a
movement gate, the **animated** clip still passes but the **frozen** confusor starts leaking through —
and the test goes red. That is the single-frame COFFEE bug made impossible from the synthesis side.

## Calibration workflow (human-in-the-loop)

1. `python -m tools.synthesize_demo` → renders clips, auto-fills `verifier_passed` via the gate.
2. A fluent/Deaf signer watches each `reference_clips/<SIGN>.gif`.
3. To approve / reject, record the verdict (corrections are made by editing **schema parameters**,
   never by hand-tuning IK, then regenerating):
   ```python
   from core.calibration import CalibrationLog
   log = CalibrationLog().load()
   log.mark_reviewed("COFFEE", approved=True, notes="grind radius natural")
   log.mark_reviewed("PLEASE", approved=False, notes="circle too wide; lower radius in schema")
   log.save()
   ```
4. A clip ships only once `log.get(sign).shippable` is true. `log.assert_shippable(sign)` guards a
   release and raises otherwise.

## Deliberately deferred (per the report's Phase-9 reality check)

- A **rigged glTF/GLB avatar** and **browser Three.js** runtime. The deterministic math here
  (presets as quaternion-style data, easing, parametric curves, analytical 2-bone IK) ports directly
  to `@mediapipe/tasks-vision` + Three.js when recognition is ported.
- **Procedural facial non-manual markers** (Phase 8) — withheld until scenarios actually demand
  grammatical NMMs, to avoid the uncanny valley.
- The reference slot is **medium-agnostic**: early signs can use recorded human video; long-tail
  vocabulary can use these procedural clips. The lesson loop doesn't care which.
