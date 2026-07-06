"""Live calibration tool: cycle through every sign in one running session, with reference
points drawn on hands + shoulders so you can see exactly what the tracker sees while you
deliberately test edge cases (wrong handshape, wrong direction, one hand, etc.).

This is `demo_verify.py` extended so you don't have to restart the process to switch signs.

Run (venv active, models downloaded, Python 3.14 w/ mediapipe+opencv):
    python -m tools.live_calibrate                  # starts on the first sign, alphabetical
    python -m tools.live_calibrate --sign TEACHER    # start on a specific sign
    python -m tools.live_calibrate --group classroom # only cycle TEACHER/WRITE/READ/NAME/FRIEND/MORE/LETTER_I/LETTER_W

Controls (focus the video window first):
    n / RIGHT ARROW   next sign
    p / LEFT ARROW    previous sign
    r                 clear the rolling buffer (fresh start — do this before each new attempt,
                      especially right after a correct attempt, so leftover motion doesn't bleed
                      into the next edge case you test)
    q / ESC           quit

On-screen reference points:
    green dots   every hand landmark (21 points/hand) MediaPipe tracked
    red dot      that hand's palm center (used for location checks)
    blue dots    left/right shoulder (used to normalize distances + as a location anchor)
The scorecard below shows one bar per required/optional parameter — green once it clears its
threshold, red if required and still failing, gray if optional. Use this to see WHICH parameter
an edge case fails on, matching the automated confusor tests in tests/test_calibration_edge_cases.py.
"""
from __future__ import annotations

import argparse
import time

import cv2
import numpy as np

from core.capture import Capture
from core.landmarks import RollingBuffer
from core.verifier import location_debug, movement_debug, verify
from signs import SIGNS

# The signs calibrated most recently — first in rotation since that's the likely reason you're
# running this, but every other sign in the registry follows so you can test "each word."
_PRIORITY = ["TEACHER", "WRITE", "READ", "NAME", "FRIEND", "MORE", "LETTER_I", "LETTER_W"]

GROUPS = {
    "classroom": _PRIORITY,
    "all": _PRIORITY + sorted(n for n in SIGNS if n not in _PRIORITY),
}


def _draw_scorecard(img, result, move_dbg: str, loc_dbg: str, idx: int, total: int) -> None:
    x, y, line = 12, 34, 30
    banner = "PASS" if result.passed else "sign it..."
    color = (0, 200, 0) if result.passed else (0, 165, 255)
    cv2.putText(img, f"[{idx + 1}/{total}] {result.sign_name}:  {banner}", (x, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2, cv2.LINE_AA)
    dom = result.roles.get("dominant", "-")
    cv2.putText(img, f"dominant hand: {dom}   (n/p: switch sign, r: reset, q: quit)", (x, y + 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    y += 52
    for p in result.params:
        if p.cleared:
            col = (0, 200, 0)
        elif p.required:
            col = (0, 0, 255)
        else:
            col = (130, 130, 130)
        bar = int(np.clip(p.score, 0.0, 1.0) * 130)
        cv2.rectangle(img, (x, y - 13), (x + 130, y + 1), (70, 70, 70), 1)
        cv2.rectangle(img, (x, y - 13), (x + bar, y + 1), col, -1)
        tag = "req" if p.required else "opt-ignored"
        txt_col = (255, 255, 255) if p.required else (150, 150, 150)
        cv2.putText(img, f"{p.name:<22}{p.score:0.2f} / {p.threshold:0.2f} [{tag}]",
                    (x + 140, y), cv2.FONT_HERSHEY_SIMPLEX, 0.48, txt_col, 1, cv2.LINE_AA)
        y += line
    cv2.putText(img, f"movement: {move_dbg}", (x, y + 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    if loc_dbg:
        cv2.putText(img, loc_dbg, (x, y + 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)


def main(start_sign: str | None, camera_index: int, group: str) -> None:
    rotation = GROUPS.get(group)
    if rotation is None:
        raise SystemExit(f"Unknown --group '{group}'. Known: {list(GROUPS)}")

    idx = 0
    if start_sign:
        if start_sign not in SIGNS:
            raise SystemExit(f"Unknown sign '{start_sign}'. Known: {list(SIGNS)}")
        if start_sign in rotation:
            idx = rotation.index(start_sign)
        else:
            rotation = [start_sign] + rotation

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise SystemExit(f"Could not open webcam (index {camera_index}). Try --camera 1.")

    buffer = RollingBuffer(window_seconds=2.0)
    t0 = time.monotonic()
    print(f"[live_calibrate] cycling {len(rotation)} signs; press 'q' in the window to quit.")

    win = "ASL_Game live calibration (n/p switch, r reset, q quit)"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setWindowProperty(win, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

    with Capture() as capture:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            bgr = cv2.flip(bgr, 1)
            t = time.monotonic() - t0
            frame = capture.process(bgr, timestamp_ms=int(t * 1000), t_seconds=t)
            buffer.add(frame)

            for hand in frame.hands:
                for px, py, _z in hand.points:
                    cv2.circle(bgr, (int(px), int(py)), 3, (0, 255, 0), -1)
                cx, cy = hand.center
                cv2.circle(bgr, (int(cx), int(cy)), 6, (0, 0, 255), -1)
            if frame.left_shoulder is not None and frame.right_shoulder is not None:
                for sx, sy in (frame.left_shoulder, frame.right_shoulder):
                    cv2.circle(bgr, (int(sx), int(sy)), 6, (255, 0, 0), -1)

            sign_name = rotation[idx]
            sign = SIGNS[sign_name]
            _draw_scorecard(bgr, verify(buffer, sign), movement_debug(buffer, sign),
                             location_debug(buffer, sign), idx, len(rotation))
            cv2.imshow(win, bgr)

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):  # 27 = ESC
                break
            elif key in (ord("n"), 83):  # 83 = right arrow (platform-dependent code, best-effort)
                idx = (idx + 1) % len(rotation)
                buffer.clear()
            elif key in (ord("p"), 81):  # 81 = left arrow (platform-dependent code, best-effort)
                idx = (idx - 1) % len(rotation)
                buffer.clear()
            elif key == ord("r"):
                buffer.clear()

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sign", default=None, help="sign name to start on (default: first in --group)")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    ap.add_argument("--group", default="classroom", choices=list(GROUPS),
                     help="'classroom' = today's 8 calibrated signs (default), 'all' = every sign in the registry")
    args = ap.parse_args()
    main(args.sign, args.camera, args.group)
