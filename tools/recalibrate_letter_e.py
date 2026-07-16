"""One-off recording session for LETTER_E's fist confusor found via live user testing on
2026-07-15: a plain closed fist still passes LETTER_E's handshape check. Same
preview -> SPACE -> 3s countdown -> record flow as the other recalibrate_*.py tools.

Run (venv active, models downloaded):
    python -m tools.recalibrate_letter_e --seconds 4
"""
from __future__ import annotations

import argparse

from core.landmarks import Frame, RollingBuffer
from core.recorder import record
from core.verifier import location_debug, movement_debug, verify
from signs import SIGNS

FIXTURES_DIR = "tests/fixtures"

TAKES = [
    ("LETTER_E", "correct", "Sign a genuine LETTER_E — fingers bent at the middle knuckle, thumb tucked under."),
    ("LETTER_E", "fist", "Make a PLAIN CLOSED FIST — not trying to sign E, just a relaxed fist."),
]


def _report(frames: list[Frame], sign_name: str, kind: str) -> None:
    sign = SIGNS[sign_name]
    print(f"\n{'-' * 70}\n{sign_name} [{kind}]: {len(frames)} frames, "
          f"{sum(1 for f in frames if len(f.hands) >= 1)} with a hand detected")

    for window_s in (1.5, 2.0, 2.5):
        buf = RollingBuffer(window_seconds=window_s)
        for f in frames:
            buf.add(f)
        result = verify(buf, sign)
        banner = "PASS" if result.passed else "FAIL"
        print(f"  window={window_s}s -> {banner}")
        for p in result.params:
            tag = "req" if p.required else "opt"
            clear = "OK " if p.cleared else ".. "
            print(f"    [{clear}] {p.name:<22} {p.score:0.3f} / {p.threshold:0.3f}  [{tag}]")
        print(f"    movement debug: {movement_debug(buf, sign)}")
        loc = location_debug(buf, sign)
        if loc:
            print(f"    location debug: {loc}")


def main(seconds: float, camera_index: int) -> None:
    results: dict[tuple[str, str], list[Frame]] = {}
    for sign_name, kind, instruction in TAKES:
        out_path = f"{FIXTURES_DIR}/{sign_name.lower()}_{kind}.json"
        print(f"\n>>> {sign_name} / {kind}: {instruction}")
        print(f"    preview window opening — SPACE to record ({seconds:.0f}s), q to skip.", flush=True)
        frames = record(out_path, seconds=seconds, camera_index=camera_index,
                         sign_name=sign_name, instruction=f"[{kind.upper()}] {instruction}")
        if not frames:
            print(f"{sign_name}/{kind}: skipped/cancelled.")
            continue
        results[(sign_name, kind)] = frames

    for (sign_name, kind), frames in results.items():
        _report(frames, sign_name, kind)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=4.0, help="recording length per take")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    args = ap.parse_args()
    main(args.seconds, args.camera)
