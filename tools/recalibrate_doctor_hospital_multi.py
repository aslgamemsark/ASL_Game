"""Multi-take re-verification for DOCTOR and HOSPITAL's documented rapid-movement ceilings (and
DOCTOR's clapping bug), following the same methodology that showed HELP's ceiling was actually a
noisy, probabilistic single-sample artifact rather than a reliably-reproducible bug — this checks
whether DOCTOR/HOSPITAL's ceilings are CONSISTENT across multiple independent takes (a real,
reproducible bug) or similarly noisy (in which case that changes how seriously to treat them).

Records DOCTOR correct_2, rapid_2, rapid_3, clap_2 and HOSPITAL correct_2, rapid_2, rapid_3 into
tests/fixtures/, then reports the live-window (2.0s) consecutive-pass streak for every take of
both signs (existing + new), so the spread across takes is visible at a glance.

Run (venv active, models downloaded):
    python -m tools.recalibrate_doctor_hospital_multi --seconds 4
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from core.landmarks import Frame, RollingBuffer
from core.recorder import record
from core.verifier import verify
from signs import DOCTOR, HOSPITAL

FIXTURES_DIR = "tests/fixtures"
LIVE_WINDOW_S = 2.0
CONSECUTIVE_REQUIRED = 6

TAKES = [
    ("DOCTOR", "correct_2", "Perform the REAL sign clearly: flat hand taps opposite wrist, twice."),
    ("DOCTOR", "rapid_2", "Move your hands FAST and randomly near the same spot — NOT the sign."),
    ("DOCTOR", "rapid_3", "Move your hands FAST and randomly again — vary the pattern."),
    ("DOCTOR", "clap_2", "CLAP both open hands together repeatedly — NOT a wrist tap."),
    ("HOSPITAL", "correct_2", "Perform the REAL sign clearly: 2 fingers draw a small cross near your shoulder."),
    ("HOSPITAL", "rapid_2", "Move your hands FAST and randomly near the same spot — NOT the sign."),
    ("HOSPITAL", "rapid_3", "Move your hands FAST and randomly again — vary the pattern."),
]


def _load(name: str) -> list[Frame]:
    path = Path(FIXTURES_DIR) / f"{name}.json"
    if not path.exists():
        return []
    data = json.load(open(path))
    return [Frame.from_dict(fd) for fd in data["frames"]]


def _best_streak(frames: list[Frame], sign) -> int:
    buf = RollingBuffer(window_seconds=LIVE_WINDOW_S)
    streak = best = 0
    for f in frames:
        buf.add(f)
        if verify(buf, sign).passed:
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return best


def main(seconds: float, camera_index: int) -> None:
    for sign_name, kind, instruction in TAKES:
        out_path = f"{FIXTURES_DIR}/{sign_name.lower()}_{kind}.json"
        print(f"\n>>> {sign_name} / {kind}: {instruction}")
        print(f"    preview window opening — SPACE to record ({seconds:.0f}s), q to skip.", flush=True)
        record(out_path, seconds=seconds, camera_index=camera_index,
               sign_name=sign_name, instruction=f"[{kind.upper()}] {instruction}")

    print(f"\n{'=' * 70}\nCross-take comparison (live {LIVE_WINDOW_S}s window, {CONSECUTIVE_REQUIRED}-frame debounce)\n{'=' * 70}")
    for sign_name, sign, kinds in (
        ("DOCTOR", DOCTOR, ["correct", "correct_2", "rapid", "rapid_2", "rapid_3", "clap", "clap_2"]),
        ("HOSPITAL", HOSPITAL, ["correct", "correct_2", "rapid", "rapid_2", "rapid_3"]),
    ):
        print(f"\n--- {sign_name} ---")
        for kind in kinds:
            frames = _load(f"{sign_name.lower()}_{kind}")
            if not frames:
                print(f"  {kind:12s}: (no fixture)")
                continue
            streak = _best_streak(frames, sign)
            verdict = "TRIGGERS" if streak >= CONSECUTIVE_REQUIRED else "safe"
            print(f"  {kind:12s}: n={len(frames):3d}  best_streak={streak:3d}  [{verdict}]")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=4.0, help="recording length per take")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    args = ap.parse_args()
    main(args.seconds, args.camera)
