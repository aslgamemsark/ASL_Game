"""Hospital scenario entry point.

Thin game loop: read webcam -> core.capture -> fill the rolling buffer -> verify the active sign
-> render the hospital scene. The learner works through a queue of "patients", each needing one
sign. Success fires ONLY on an overall verifier pass (every required parameter cleared) — never on
a single frame, never on handshape alone. On success the next patient steps up.

Reuses core/ and signs/ unchanged; only the theme/assets differ from the coffee-shop scenario.

Run:
    python -m scenarios.hospital_shop.main            # play
    python -m scenarios.hospital_shop.main --debug    # show live per-parameter scores
Keys: q = quit,  n = skip to the next patient (handy for practising one sign).
"""
from __future__ import annotations

import argparse
import time

import cv2

from core.capture import Capture
from core.landmarks import HandStabilizer, RollingBuffer
from core.lesson import PassDebouncer
from core.verifier import movement_debug, verify
from scenarios.hospital_shop.scene import HospitalScene
from signs import HELP, PAIN, MEDICINE, EMERGENCY, FEVER, WATER, HOSPITAL, DIZZY

SUCCESS_SECONDS = 2.0

# The patient queue: (sign, banner title, how-to instruction). Cycles forever.
# v1 ships the 8 signs that recognise reliably (calibrated to real recordings). DOCTOR, NURSE,
# SICK and BREATHE are at the rule-based ceiling (the signer's hand reads "open" for the
# distinguishing shapes) — their definitions and recordings are kept for the learned classifier.
PATIENTS = [
    (HELP, "A patient needs HELP", "Rest your FIST on your open palm, then lift the fist straight UP"),
    (PAIN, "Where's the PAIN?", "Point both index fingers and move them TOWARD each other"),
    (MEDICINE, "Give the MEDICINE", "Open hand over your other palm: twist it back and forth"),
    (EMERGENCY, "It's an EMERGENCY!", "Make a claw and SHAKE it quickly, side to side"),
    (FEVER, "Check for FEVER", "Open hand: sweep it across your forehead"),
    (WATER, "The patient needs WATER", "Three fingers (W): hold them at your chin"),
    (HOSPITAL, "Go to the HOSPITAL", "Two fingers (H) near your opposite shoulder: draw a small cross"),
    (DIZZY, "The patient feels DIZZY", "Open hand up by your face: circle it in a loop"),
]


def main(camera_index: int = 0, debug: bool = False) -> None:
    scene = HospitalScene()
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise SystemExit(f"Could not open webcam (index {camera_index}). Try --camera 1.")

    idx = 0
    buffer = RollingBuffer(window_seconds=1.5)       # short window: stale motion evicts quickly
    stabilizer = HandStabilizer(hold_seconds=0.3)    # bridge brief hand-detection dropouts
    score = 0
    state = "playing"          # "playing" | "success"
    success_start = 0.0
    debouncer = PassDebouncer()  # shared with classroom/coffee_shop — see core/lesson.py
    t0 = time.monotonic()
    last_log = 0.0             # throttled debug transcript so results can be reviewed

    win = "ASL Hospital"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, scene.W, scene.H)

    def advance():
        nonlocal idx, state
        idx = (idx + 1) % len(PATIENTS)
        state = "playing"
        debouncer.reset()
        buffer.clear()

    with Capture() as capture:
        while True:
            ok, bgr = cap.read()
            if not ok:
                continue
            bgr = cv2.flip(bgr, 1)
            t = time.monotonic() - t0
            frame = capture.process(bgr, timestamp_ms=int(t * 1000), t_seconds=t)
            frame = stabilizer.stabilize(frame)
            buffer.add(frame)

            sign, title, instruction = PATIENTS[idx]
            result = verify(buffer, sign)
            now = time.monotonic()

            if debug and frame.hands and (t - last_log) > 0.5:
                bits = "  ".join(f"{p.name.split('_')[0][:4]}:{p.score:.2f}" for p in result.params)
                print(f"[{t:6.1f}s] {sign.name:9s} {'PASS' if result.passed else 'fail':4s}  {bits}", flush=True)
                last_log = t

            if state == "playing" and debouncer.record(now, result.passed):
                state = "success"
                success_start = now
                score += 1
                print(f"[{t:6.1f}s] *** {sign.name} TREATED (score={score}) ***", flush=True)
                buffer.clear()          # avoid immediately re-triggering on the same motion

            progress = 0.0
            if state == "success":
                progress = (now - success_start) / SUCCESS_SECONDS
                if progress >= 1.0:
                    advance()
                    continue

            debug_overlay = (result, movement_debug(buffer, sign)) if debug else None
            canvas = scene.render(bgr, title, instruction, score, state, progress, debug_overlay)
            cv2.imshow(win, canvas)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("n"):
                advance()

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    ap.add_argument("--debug", action="store_true", help="show live per-parameter scores")
    args = ap.parse_args()
    main(args.camera, args.debug)
