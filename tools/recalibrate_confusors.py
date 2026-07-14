"""One-off recording session for specific named confusors found via live user testing on
2026-07-14, distinct from the earlier idle/rapid pass in tools/recalibrate_words.py:

  DOCTOR / NURSE — clapping (both open hands, palms closing together, repeatedly) satisfies every
    parameter these two signs check (open handshape, hands getting very close, repeated motion)
    without ever targeting the wrist specifically, since the location check's "closest approach"
    only measures the nearest point between the two hands' 21 landmarks, not distance to the
    other hand's WRIST point.
  NURSE — a plain middle-finger tap, no index extension (the "N" pattern should need both).
  MEDICINE — only the non-dominant hand moves near the still dominant hand (both hands share the
    same "open" handshape, so role assignment falls back to "whichever hand moved more").

Each of these is recorded once per sign into tests/fixtures/<sign>_<confusor>.json using the same
core.recorder.record() flow (preview -> SPACE -> countdown -> record) as the other calibration
tools, with the specific instruction shown on the video overlay.

Run (venv active, models downloaded):
    python -m tools.recalibrate_confusors --seconds 4
"""
from __future__ import annotations

import argparse

from core.landmarks import Frame, RollingBuffer
from core.recorder import record
from core.verifier import location_debug, movement_debug, verify
from signs import SIGNS

FIXTURES_DIR = "tests/fixtures"

# (sign, fixture_suffix, instruction)
TAKES = [
    ("DOCTOR", "clap", "CLAP both open hands together repeatedly — NOT a wrist tap."),
    ("NURSE", "clap", "CLAP both open hands together repeatedly — NOT a wrist tap."),
    ("NURSE", "middle_only", "Tap your PLAIN MIDDLE FINGER on your wrist — index NOT extended."),
    ("MEDICINE", "wrong_hand", "Hold your ACTING hand still; wiggle your OTHER hand near it instead."),
]


def _report(frames: list[Frame], sign_name: str, kind: str) -> None:
    sign = SIGNS[sign_name]
    print(f"\n{'-' * 70}\n{sign_name} [{kind}]: {len(frames)} frames, "
          f"{sum(1 for f in frames if len(f.hands) >= 2)} with both hands")

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
