"""Record live normalized frames to a JSON fixture for the confusor test suite.

Each fixture is a list of Frame.to_dict() snapshots captured over a few seconds. The verifier
replays these the same way it reads a live buffer — no special fixture format, just the same
Frame model serialized to JSON.

Flow: a live preview window opens (normal-sized, not fullscreen) showing how many hands are
detected. You position your hands, then press SPACE to start the timed recording. This also
warms up the hand model during the preview, so recording captures hands from the first frame.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import cv2

from core.capture import Capture
from core.landmarks import Frame


def _put_text(bgr, text, org, scale=0.8, color=(0, 255, 255), thickness=2) -> None:
    """High-contrast text: solid black backing box so it reads against any background/lighting/
    skin tone — a plain cv2.putText in white/yellow washed out and became unreadable during a
    live session, so every overlay line here gets a filled backing rect first."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
    x, y = org
    cv2.rectangle(bgr, (x - 6, y - th - 6), (x + tw + 6, y + baseline + 6), (0, 0, 0), -1)
    cv2.putText(bgr, text, (x, y), font, scale, color, thickness, cv2.LINE_AA)


def _draw_hands(bgr, frame) -> None:
    for hand in frame.hands:
        for px, py, _z in hand.points:
            cv2.circle(bgr, (int(px), int(py)), 3, (0, 255, 0), -1)   # green landmarks
        cx, cy = hand.center
        cv2.circle(bgr, (int(cx), int(cy)), 6, (0, 0, 255), -1)        # red palm center
    if frame.left_shoulder is not None and frame.right_shoulder is not None:
        for sx, sy in (frame.left_shoulder, frame.right_shoulder):
            cv2.circle(bgr, (int(sx), int(sy)), 6, (255, 0, 0), -1)    # blue shoulders


def record(
    output_path: str | Path,
    seconds: float = 3.0,
    camera_index: int = 0,
    sign_name: str = "",
    instruction: str = "",
) -> list[Frame]:
    """Preview → (press SPACE) → record `seconds` of landmarks → write JSON. Returns frames.

    `instruction` (optional) renders on the video overlay itself — e.g. "move hands FAST and
    randomly — NOT the sign" — so a caller doing multiple differently-instructed takes of the same
    sign (see tools/recalibrate_words.py) doesn't rely on the user reading a separate console.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    label = sign_name or output_path.stem

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open webcam (index {camera_index}).")

    win = f"Record: {label}"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, 960, 720)

    frames: list[Frame] = []
    ts = 0  # monotonic timestamp counter for MediaPipe (real time lives on frame.t)

    with Capture() as capture:
        # --- Preview: position hands; SPACE starts recording, q cancels ---
        cancelled = False
        while True:
            ok, bgr = cap.read()
            if not ok:
                continue
            bgr = cv2.flip(bgr, 1)
            ts += 33
            frame = capture.process(bgr, timestamp_ms=ts, t_seconds=0.0)
            _draw_hands(bgr, frame)

            nh = len(frame.hands)
            col = (0, 200, 0) if nh >= 2 else (0, 165, 255) if nh == 1 else (0, 0, 255)
            _put_text(bgr, f"hands detected: {nh}", (15, 40), 0.8, col, 2)
            _put_text(bgr, "position hands, press SPACE to record", (15, 78), 0.65, (0, 255, 255), 2)
            _put_text(bgr, f"Sign: {label}    (q = cancel)", (15, 112), 0.6, (255, 255, 255), 1)
            if instruction:
                _put_text(bgr, instruction, (15, 148), 0.65, (0, 165, 255), 2)
            cv2.imshow(win, bgr)

            key = cv2.waitKey(1) & 0xFF
            if key == ord(" "):
                break
            if key == ord("q"):
                cancelled = True
                break

        if cancelled:
            cap.release()
            cv2.destroyAllWindows()
            print("Cancelled — nothing recorded.")
            return []

        # --- Countdown: 3 seconds to get into position after pressing SPACE ---
        countdown_end = time.monotonic() + 3.0
        while True:
            ok, bgr = cap.read()
            if not ok:
                continue
            bgr = cv2.flip(bgr, 1)
            ts += 33
            frame = capture.process(bgr, timestamp_ms=ts, t_seconds=0.0)
            _draw_hands(bgr, frame)
            left = countdown_end - time.monotonic()
            if left <= 0:
                break
            _put_text(bgr, f"GET READY: {int(left) + 1}", (15, 60), 1.4, (0, 255, 255), 3)
            _put_text(bgr, f"hands: {len(frame.hands)}", (15, 100), 0.6, (255, 255, 255), 2)
            if instruction:
                _put_text(bgr, instruction, (15, 136), 0.65, (0, 165, 255), 2)
            cv2.imshow(win, bgr)
            cv2.waitKey(1)

        # --- Record for `seconds` ---
        t0 = time.monotonic()
        while True:
            ok, bgr = cap.read()
            if not ok:
                continue
            bgr = cv2.flip(bgr, 1)
            elapsed = time.monotonic() - t0
            remaining = seconds - elapsed
            if remaining <= 0:
                break
            ts += 33
            frame = capture.process(bgr, timestamp_ms=ts, t_seconds=elapsed)
            frames.append(frame)

            _draw_hands(bgr, frame)
            _put_text(bgr, f"RECORDING  {remaining:.1f}s", (15, 50), 1.0, (0, 60, 255), 2)
            _put_text(bgr, f"hands: {len(frame.hands)}", (15, 86), 0.6, (255, 255, 255), 2)
            if instruction:
                _put_text(bgr, instruction, (15, 122), 0.65, (0, 165, 255), 2)
            cv2.imshow(win, bgr)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()

    if not frames:
        print("WARNING: no frames captured. File not written.")
        return frames

    data = {"sign_name": sign_name, "frames": [f.to_dict() for f in frames]}
    with open(output_path, "w") as fh:
        json.dump(data, fh)

    with_both = sum(1 for f in frames if len(f.hands) >= 2)
    print(f"Recorded {len(frames)} frames ({frames[-1].t - frames[0].t:.1f}s), "
          f"{with_both} with both hands -> {output_path}")
    return frames
