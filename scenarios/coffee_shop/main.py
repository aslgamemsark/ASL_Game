"""Coffee-shop scenario entry point.

A lesson of 3 levels (13 signs): Greetings, Cafe Order, Fingerspelling. Each correct sign earns
+10, advances, and rolls into a level-complete card then the next level, ending in a summary.
Success fires ONLY on an overall verifier pass (every required parameter cleared).

Run:
    python -m scenarios.coffee_shop.main            # play
    python -m scenarios.coffee_shop.main --debug    # show live per-parameter scores
"""
from __future__ import annotations

import argparse
import time

import cv2

from core.capture import Capture
from core.landmarks import HandStabilizer, RollingBuffer
from core.lesson import GameSession, Level, Prompt
from core.verifier import movement_debug, verify
from scenarios.coffee_shop.scene import CoffeeShopScene
from signs import (
    COFFEE, HELLO, LETTER_A, LETTER_B, LETTER_L, LETTER_V, LETTER_Y,
    MORE, PLEASE, THANK_YOU, WANT, YES, YOU,
)


def build_levels() -> list[Level]:
    return [
        Level("Greetings", [
            Prompt(HELLO, "Wave HELLO - open hand, wave side to side"),
            Prompt(PLEASE, "PLEASE - open hand, circle on your chest"),
            Prompt(THANK_YOU, "THANK YOU - open hand from your chin, move down"),
            Prompt(YOU, "YOU - point your index finger forward"),
        ]),
        Level("Cafe Order", [
            Prompt(COFFEE, "COFFEE - two fists, grind the top over the bottom"),
            Prompt(WANT, "WANT - both open hands, pull down toward you"),
            Prompt(MORE, "MORE - both claw hands, tap fingertips together"),
            Prompt(YES, "YES - a fist, nod it up and down"),
        ]),
        Level("Fingerspelling", [
            Prompt(LETTER_A, "Letter A - a fist with the thumb at the side"),
            Prompt(LETTER_B, "Letter B - flat open hand, fingers together"),
            Prompt(LETTER_L, "Letter L - index up, thumb out"),
            Prompt(LETTER_V, "Letter V - index and middle up (peace)"),
            Prompt(LETTER_Y, "Letter Y - thumb and pinky out"),
        ]),
    ]


def main(camera_index: int = 0, debug: bool = False) -> None:
    scene = CoffeeShopScene()
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise SystemExit(f"Could not open webcam (index {camera_index}). Try --camera 1.")

    buffer = RollingBuffer(window_seconds=2.0)
    stabilizer = HandStabilizer(hold_seconds=0.3)
    session = GameSession(build_levels())
    t0 = time.monotonic()

    win = "ASL Coffee Shop"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, scene.W, scene.H)

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

            now = time.monotonic()
            debug_overlay = None
            if session.state == "playing":
                sign = session.prompt.sign
                result = verify(buffer, sign)
                if result.passed:
                    session.on_pass(now)
                    buffer.clear()
                    stabilizer.reset()
                if debug:
                    debug_overlay = (result, movement_debug(buffer, sign))
            session.update(now)

            canvas = scene.render(session, bgr, now, debug_overlay)
            cv2.imshow(win, canvas)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("r") and session.state == "finished":
                session = GameSession(build_levels())     # replay
                buffer.clear(); stabilizer.reset()

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    ap.add_argument("--debug", action="store_true", help="show live per-parameter scores")
    args = ap.parse_args()
    main(args.camera, args.debug)
