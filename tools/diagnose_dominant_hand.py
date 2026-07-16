"""Diagnostic recording for the onboarding dominant-hand picker (DominantHandStep.tsx) — records
raising the right hand and the left hand and reports what MediaPipe's handedness label actually
says for each, plus effective frame rate through this pipeline. Same preview -> SPACE -> 3s
countdown -> record flow as the other recalibrate_*.py tools.

Note: core/recorder.py mirrors the frame (cv2.flip) BEFORE running MediaPipe, matching how a
selfie camera is normally fed to the model. The web app does the opposite — it feeds MediaPipe
the RAW un-mirrored frame and only mirrors afterward, for display. So the handedness label this
script reports is not directly comparable to the web app's raw label; it's a sanity check on
which hand you actually raised, not a stand-in for the browser's pipeline.

Run (venv active, models downloaded):
    python -m tools.diagnose_dominant_hand --seconds 4
"""
from __future__ import annotations

import argparse
import statistics

from core.landmarks import Frame
from core.recorder import record

TAKES = [
    ("right_hand", "Raise your RIGHT hand, like starting the onboarding step."),
    ("left_hand", "Raise your LEFT hand, like starting the onboarding step."),
]


def _report(label: str, frames: list[Frame]) -> None:
    print(f"\n{'-' * 70}\n{label}: {len(frames)} frames")
    single_hand = [f for f in frames if len(f.hands) == 1]
    multi_hand = [f for f in frames if len(f.hands) > 1]
    none_hand = [f for f in frames if len(f.hands) == 0]
    print(f"  frames with exactly 1 hand: {len(single_hand)}")
    print(f"  frames with >1 hand:        {len(multi_hand)}")
    print(f"  frames with 0 hands:        {len(none_hand)}")

    if single_hand:
        labels = [f.hands[0].handedness for f in single_hand]
        left_n = labels.count("Left")
        right_n = labels.count("Right")
        print(f"  MediaPipe handedness label — Left: {left_n}, Right: {right_n}")
        # x-position summary (pixels, RAW/un-mirrored — this is what capture.ts hands to the app)
        xs = [f.hands[0].points[0][0] / f.width for f in single_hand if f.width > 0]
        if xs:
            print(f"  raw wrist x-fraction — min: {min(xs):.3f}  max: {max(xs):.3f}  "
                  f"mean: {statistics.mean(xs):.3f}")

    if len(frames) >= 2:
        dt = frames[-1].t - frames[0].t
        if dt > 0:
            print(f"  effective rate through this pipeline: {len(frames) / dt:.1f} fps "
                  f"({len(frames)} frames / {dt:.2f}s)")


def main(seconds: float, camera_index: int) -> None:
    results: dict[str, list[Frame]] = {}
    for label, instruction in TAKES:
        out_path = f"tests/fixtures/_diag_{label}.json"
        print(f"\n>>> {label}: {instruction}")
        print(f"    preview window opening — SPACE to record ({seconds:.0f}s), q to skip.", flush=True)
        frames = record(out_path, seconds=seconds, camera_index=camera_index,
                         sign_name=label, instruction=instruction)
        if not frames:
            print(f"{label}: skipped/cancelled.")
            continue
        results[label] = frames

    for label, frames in results.items():
        _report(label, frames)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=4.0, help="recording length per take")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    args = ap.parse_args()
    main(args.seconds, args.camera)
