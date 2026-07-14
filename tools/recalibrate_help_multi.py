"""Multi-take investigation for HELP's rapid-movement ceiling: a single recorded take of each
kind wasn't enough to find a reliable discriminating signal (several derived features inverted
between takes) — this records SEVERAL independent takes of both "correct" and "rapid" so any real
pattern has to show up consistently, not just once.

Records HELP correct x3, HELP rapid x3 into tests/fixtures/help_correct_2.json,
help_correct_3.json, help_rapid_2.json, help_rapid_3.json (the existing help_correct.json /
help_rapid.json from the earlier session are left alone and also analyzed).

After recording, prints per-take: movement confidence, step-direction-upward fraction, and fist-
handshape stability, across all takes of each kind, so the spread within a kind (not just one
sample) is visible.

Run (venv active, models downloaded):
    python -m tools.recalibrate_help_multi --seconds 4
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from core.landmarks import Frame, RollingBuffer
from core.recorder import record
from core.handshape import fist_confidence
from core.verifier import assign_roles, verify, _latest_shoulder_width, _trajectory
from signs import HELP
from core.schema import DOMINANT

FIXTURES_DIR = "tests/fixtures"

TAKES = [
    ("correct_2", "Perform the REAL sign clearly: fist rests on open palm, then lifts UP."),
    ("correct_3", "Perform the REAL sign clearly again — a slightly different pace/style."),
    ("rapid_2", "Move your hands FAST and randomly near the same spot — NOT the sign."),
    ("rapid_3", "Move your hands FAST and randomly again — vary the pattern from last time."),
]


def _load(name: str) -> list[Frame]:
    path = Path(FIXTURES_DIR) / f"{name}.json"
    if not path.exists():
        return []
    data = json.load(open(path))
    return [Frame.from_dict(fd) for fd in data["frames"]]


def _metrics(frames: list[Frame], window_s: float = 2.0) -> dict:
    buf = RollingBuffer(window_seconds=window_s)
    move_scores, up_fracs, fist_scores = [], [], []
    for f in frames:
        buf.add(f)
        roles = assign_roles(buf)
        sw = _latest_shoulder_width(buf)
        dl = roles.get(DOMINANT)
        h = f.hand(dl) if dl else None
        if h is not None:
            fist_scores.append(fist_confidence(h))
        r = verify(buf, HELP)
        m = r.get("movement")
        if m:
            move_scores.append(m.score)
        traj = _trajectory(buf, dl)
        if len(traj) >= 3 and sw:
            pts = np.array([c for _, c in traj])
            steps = np.diff(pts, axis=0)
            mags = np.linalg.norm(steps, axis=1)
            valid = mags > 1e-6
            if valid.sum() > 0:
                up = np.array([0.0, -1.0])
                cosines = (steps[valid] @ up) / mags[valid]
                up_fracs.append(float(np.mean(cosines > 0.3)))
    return {
        "n_frames": len(frames),
        "move_median": float(np.median(move_scores)) if move_scores else None,
        "up_frac_median": float(np.median(up_fracs)) if up_fracs else None,
        "fist_median": float(np.median(fist_scores)) if fist_scores else None,
    }


def main(seconds: float, camera_index: int) -> None:
    for kind, instruction in TAKES:
        out_path = f"{FIXTURES_DIR}/help_{kind}.json"
        print(f"\n>>> HELP / {kind}: {instruction}")
        print(f"    preview window opening — SPACE to record ({seconds:.0f}s), q to skip.", flush=True)
        record(out_path, seconds=seconds, camera_index=camera_index,
               sign_name="HELP", instruction=f"[{kind.upper()}] {instruction}")

    print(f"\n{'=' * 70}\nCross-take comparison\n{'=' * 70}")
    all_names = ["correct", "correct_2", "correct_3", "rapid", "rapid_2", "rapid_3"]
    for name in all_names:
        frames = _load(f"help_{name}")
        if not frames:
            print(f"{name:12s}: (no fixture)")
            continue
        m = _metrics(frames)
        print(f"{name:12s} n={m['n_frames']:3d}  move_median={m['move_median']:.3f}  "
              f"up_frac_median={m['up_frac_median']:.3f}  fist_median={m['fist_median']:.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=4.0, help="recording length per take")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    args = ap.parse_args()
    main(args.seconds, args.camera)
