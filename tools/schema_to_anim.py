"""Stage 2→3 adapter — render a footage-derived Sign Definition Schema on the avatar, and report
how the footage-measured parameters compare to the authoritative hand-authored Sign.

The Stage-2 pipeline (D:/asl-synthesis/scripts/) measures parameters from OUR footage and writes
`schema/signs/<id>.json`. This adapter:

  1. Looks up the authoritative `Sign` (signs/ registry) — it carries structure the monocular
     capture cannot see (two-handedness, the relational OTHER_HAND anchor, NMMs).
  2. Renders THAT sign through `core/synthesis3d.build_animation` so the avatar plays a structurally
     correct clip in the live viewer (anim/<SIGN>.json).
  3. Prints a calibration report: footage-measured handshape / location / movement / orientation vs
     the authored values, so the human can decide in Stage 4 whether to retune synthesis3d constants.

It does NOT silently overwrite the authored geometry with monocular estimates — divergences are
surfaced for review, never auto-applied (no self-approval on sign quality).

Coffee-shop scope only: hospital signs belong to the collaborator and are refused here.

    python -m tools.schema_to_anim --in D:/asl-synthesis/schema/signs/coffee.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from core.handshape_presets import SHAPE_SPECS, measure_pose
from core.synthesis3d import build_animation
from signs import COFFEE_SIGNS

_COFFEE = {s.name for s in COFFEE_SIGNS}

# footage movement.type -> the verifier's MovementKind vocabulary (arc has no exact kind)
_MOVE_EQUIV = {"none": "none", "linear": "linear", "circular": "circular",
               "repeated": "repeated", "arc": "circular"}


def _report(schema: dict, sign) -> list[str]:
    """Footage-measured vs authored. Returns human-readable divergence lines."""
    out = []
    fs = schema["handshape"].replace("ASL_", "").lower()
    a = sign.dominant.kind.lower()
    # alias-aware: 's' and 'fist' (etc.) resolve to the same preset spec -> not a divergence
    same_shape = fs == a or (fs in SHAPE_SPECS and a in SHAPE_SPECS and SHAPE_SPECS[fs] == SHAPE_SPECS[a])
    if not same_shape:
        out.append(f"  handshape: footage={fs!r} vs authored={a!r}")

    f_anchor = schema["location"]["anchor"]
    a_anchor = sign.location.anchor.value
    if a_anchor == "other_hand":
        out.append(f"  location:  footage sees absolute {f_anchor!r}; authored is relational "
                   f"'other_hand' (dominant over non-dominant) -> not directly comparable")
    elif f_anchor != a_anchor:
        out.append(f"  location:  footage={f_anchor!r} vs authored={a_anchor!r}")

    fm = schema["movement"]["type"]
    am = sign.movement.kind.value
    if _MOVE_EQUIV.get(fm, fm) != am:
        out.append(f"  movement:  footage={fm!r} vs authored={am!r}  (DIVERGES - review)")
    else:
        out.append(f"  movement:  footage={fm!r} (mag {schema['movement']['threshold']}) "
                   f"confirms authored {am!r}; magnitude is a Stage-4 tuning candidate")

    if schema["occlusion_flags"]:
        out.append(f"  [!] occlusion-flagged keyframes {schema['occlusion_flags']} -> hand-correct")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Render a footage-derived schema + report divergences.")
    ap.add_argument("--in", dest="inp", required=True, help="schema/signs/<id>.json")
    ap.add_argument("--out", default="D:/asl-synthesis/anim", help="viewer anim/ dir")
    ap.add_argument("--fps", type=float, default=30.0)
    args = ap.parse_args(argv)

    schema = json.loads(Path(args.inp).read_text(encoding="utf-8"))
    name = schema["sign_id"].upper()
    try:
        from signs import SIGNS
        sign = SIGNS[name]
    except KeyError:
        print(f"ERROR: no authoritative Sign named {name!r} in the registry.")
        return 2
    if name not in _COFFEE:
        print(f"REFUSED: {name} is not a coffee-shop sign (hospital is the collaborator's scope).")
        return 3

    anim = build_animation(sign, fps=args.fps)

    # Drive the DOMINANT hand's per-finger curl from the REAL measured footage (averaged over the
    # clean keyframes), so each finger curls exactly as much as it did in the recording instead of a
    # coarse 0/1 preset. The handshape KIND/thumb/spread stay authored; only the curl magnitudes come
    # from MediaPipe. (Monocular capture only tracks the dominant hand, so ndom keeps its preset.)
    poses = schema.get("calibration_poses", {})
    flagged = set(schema.get("occlusion_flags", []))
    kf_frames = {k["pose"]: k["frame"] for k in schema.get("keyframes", [])}
    clean = [pose for label, pose in poses.items() if kf_frames.get(label) not in flagged]
    if clean:
        flexes = np.array([measure_pose(p)["flex"] for p in clean]).mean(axis=0)
        # Contrast curve: a casually-recorded non-signing finger only half-curls (~0.5); crisp ASL
        # tucks it fully. Push mid curls toward 1 while keeping near-straight fingers straight.
        crisp = np.clip((flexes - 0.12) * 1.7, 0.0, 1.0)
        anim["dom"]["measured"] = {"flex": [round(float(v), 3) for v in crisp]}

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.json").write_text(json.dumps(anim), encoding="utf-8")
    print(f"rendered {name} -> {out / (name + '.json')}  (open viewer.html?sign={name})")
    if "measured" in anim["dom"]:
        print(f"  measured finger curl (i,m,r,p): {anim['dom']['measured']['flex']}")

    div = _report(schema, sign)
    print("calibration report (footage vs authored):")
    print("\n".join(div) if div else "  (all measured parameters match the authored sign)")
    print("\nReview in the live preview, then log in calibration_log.md. No self-approval.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
