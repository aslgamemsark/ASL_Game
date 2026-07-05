"""Record real webcam takes of specific signs, then immediately run them through the verifier
and print the exact per-parameter breakdown — precise, numeric calibration data instead of eyeballing
a live overlay.

Why this exists: `live_calibrate.py` shows you a live scorecard, but numbers flash by in real time
and reading them off a moving video is hard. This tool records a fixed clip per sign (same
countdown + SPACE-to-start flow as `core/recorder.py`), saves it as a reusable JSON fixture under
`tests/fixtures/`, then replays it through the same `verify()` the live tool uses and prints a
static, exact report: every parameter's score vs threshold, and the raw movement/location debug
readouts. Also runs the same 5s clip through progressively-larger windows (1.5s/2.5s/4.0s) since a
"fails when done correctly" bug is often a rolling-window-too-short problem, not a wrong threshold.

Run (venv active, models downloaded, Python 3.14 w/ mediapipe+opencv):
    python -m tools.record_calibration --sign TEACHER
    python -m tools.record_calibration --sign TEACHER,WRITE,READ,NAME,MORE
    python -m tools.record_calibration --sign TEACHER --seconds 5
Each sign: preview window opens, press SPACE when your hands are in frame, 3s countdown, then it
records. Press 'q' during preview to cancel that sign's take (skips to the next).
"""
from __future__ import annotations

import argparse

from core.landmarks import Frame, RollingBuffer
from core.recorder import record
from core.verifier import location_debug, movement_debug, verify
from signs import SIGNS

FIXTURES_DIR = "tests/fixtures"


def _report(frames: list[Frame], sign_name: str) -> None:
    sign = SIGNS[sign_name]
    print(f"\n{'=' * 70}\n{sign_name}: {len(frames)} frames captured, "
          f"{sum(1 for f in frames if len(f.hands) >= 2)} with both hands\n{'=' * 70}")

    for window_s in (1.5, 2.5, 4.0):
        buf = RollingBuffer(window_seconds=window_s)
        for f in frames:
            buf.add(f)
        result = verify(buf, sign)
        banner = "PASS" if result.passed else "FAIL"
        print(f"\n--- window={window_s}s -> {banner} ---")
        for p in result.params:
            tag = "req" if p.required else "opt"
            clear = "OK " if p.cleared else ".. "
            print(f"  [{clear}] {p.name:<22} {p.score:0.3f} / {p.threshold:0.3f}  [{tag}]")
        print(f"  movement debug: {movement_debug(buf, sign)}")
        loc = location_debug(buf, sign)
        if loc:
            print(f"  location debug: {loc}")


def main(sign_names: list[str], seconds: float, camera_index: int) -> None:
    for sign_name in sign_names:
        if sign_name not in SIGNS:
            print(f"Skipping unknown sign '{sign_name}'. Known: {list(SIGNS)}")
            continue
        out_path = f"{FIXTURES_DIR}/calib_{sign_name.lower()}_live.json"
        print(f"\n>>> {sign_name}: preview window opening — position your hands, SPACE to record "
              f"({seconds:.0f}s), q to skip.")
        frames = record(out_path, seconds=seconds, camera_index=camera_index, sign_name=sign_name)
        if not frames:
            print(f"{sign_name}: skipped/cancelled.")
            continue
        _report(frames, sign_name)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sign", required=True,
                     help="comma-separated sign names, e.g. TEACHER,WRITE,READ,NAME,MORE")
    ap.add_argument("--seconds", type=float, default=4.0, help="recording length per sign")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    args = ap.parse_args()
    main([s.strip().upper() for s in args.sign.split(",")], args.seconds, args.camera)
