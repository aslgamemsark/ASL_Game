"""Phase 3 live demo: per-parameter verifier scores for a chosen sign.

This is the Phase 5 debug overlay brought forward so you can SEE the verifier judging your sign
in real time. It draws hand landmarks + a scorecard: one bar per parameter (green once it clears
its threshold, red below), which hand is dominant, and the overall PASS state.

Run (venv active, models downloaded):
    python -m tools.demo_verify                 # COFFEE by default
    python -m tools.demo_verify --sign LETTER_A
Press 'q' to quit.

--calibrate mode (B0 diagnostic harness, see docs/vault Workstreams for context): logs
per-parameter score DISTRIBUTIONS across two labeled recording phases — you performing the sign
CORRECTLY, and you performing its likeliest accidental false positive (the "confusor") — so a
"the scores feel wrong" complaint turns into a specific, numeric, per-parameter list of what's
actually false-failing (correct attempts scoring below threshold) or false-passing (the confusor
scoring above threshold). This does not fix anything by itself; it's the measurement step that
tells us WHAT to fix.

    python -m tools.demo_verify --sign COFFEE --calibrate
Press '1' to toggle recording the CORRECT phase, '2' to toggle recording the CONFUSOR phase,
'q' to quit — a report prints to the terminal and a CSV of every logged frame is saved under
tools/calibration_logs/ for offline analysis.
"""
from __future__ import annotations

import argparse
import csv
import statistics
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from core.capture import Capture
from core.landmarks import RollingBuffer
from core.verifier import location_debug, movement_debug, verify
from signs import SIGNS

CALIBRATION_LOG_DIR = Path(__file__).resolve().parent.parent / "tools" / "calibration_logs"


def _draw_scorecard(img, result, move_dbg: str, loc_dbg: str = "") -> None:
    x, y, line = 12, 34, 30
    banner = "PASS" if result.passed else "sign it..."
    color = (0, 200, 0) if result.passed else (0, 165, 255)
    cv2.putText(img, f"{result.sign_name}:  {banner}", (x, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2, cv2.LINE_AA)
    dom = result.roles.get("dominant", "-")
    cv2.putText(img, f"dominant hand: {dom}", (x, y + 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    y += 52
    for p in result.params:
        if p.cleared:
            col = (0, 200, 0)                       # green: cleared its threshold
        elif p.required:
            col = (0, 0, 255)                       # red: required and below threshold
        else:
            col = (130, 130, 130)                   # gray: optional, doesn't block
        bar = int(np.clip(p.score, 0.0, 1.0) * 130)
        cv2.rectangle(img, (x, y - 13), (x + 130, y + 1), (70, 70, 70), 1)
        cv2.rectangle(img, (x, y - 13), (x + bar, y + 1), col, -1)
        tag = "req" if p.required else "opt-ignored"
        txt_col = (255, 255, 255) if p.required else (150, 150, 150)
        cv2.putText(img, f"{p.name:<22}{p.score:0.2f} / {p.threshold:0.2f} [{tag}]",
                    (x + 140, y), cv2.FONT_HERSHEY_SIMPLEX, 0.48, txt_col, 1, cv2.LINE_AA)
        y += line
    # live movement + location sub-metrics (the calibration readouts)
    cv2.putText(img, f"movement: {move_dbg}", (x, y + 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    if loc_dbg:
        cv2.putText(img, loc_dbg, (x, y + 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)


def _draw_calibration_banner(img, phase: str) -> None:
    label = {
        "idle": "idle -- press 1 to record CORRECT, 2 to record CONFUSOR, q to quit + report",
        "correct": "RECORDING: perform the sign CORRECTLY -- press 1 again to stop",
        "confusor": "RECORDING: perform the likely MISTAKE (confusor) -- press 2 again to stop",
    }[phase]
    color = (0, 200, 0) if phase == "correct" else (0, 0, 255) if phase == "confusor" else (200, 200, 200)
    h = img.shape[0]
    cv2.putText(img, label, (12, h - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)


def _report_and_save(sign_name: str, log_rows: list[dict], param_names: list[str],
                      thresholds: dict[str, float], required: dict[str, bool]) -> None:
    if not log_rows:
        print("[calibrate] no frames recorded (never started a phase) -- nothing to report.")
        return

    CALIBRATION_LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = CALIBRATION_LOG_DIR / f"{sign_name}_{stamp}.csv"
    with csv_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["phase", "frame_idx", "param_name", "score", "threshold", "required"])
        writer.writeheader()
        writer.writerows(log_rows)

    by_phase_param: dict[str, dict[str, list[float]]] = {"correct": {}, "confusor": {}}
    for row in log_rows:
        by_phase_param[row["phase"]].setdefault(row["param_name"], []).append(row["score"])

    print(f"\n=== Calibration report: {sign_name} ===")
    print(f"Raw per-frame scores saved to: {csv_path}\n")
    header = f"{'parameter':<22}{'required':<10}{'threshold':<11}{'correct (n/med/min/max)':<28}{'confusor (n/med/min/max)':<28}flags"
    print(header)
    print("-" * len(header))
    for name in param_names:
        thr = thresholds[name]
        req = required[name]

        def _stats(vals: list[float]) -> str:
            if not vals:
                return "n=0 -- -- --"
            return f"n={len(vals):<3} med={statistics.median(vals):.2f} min={min(vals):.2f} max={max(vals):.2f}"

        correct_vals = by_phase_param["correct"].get(name, [])
        confusor_vals = by_phase_param["confusor"].get(name, [])

        flags = []
        if req and correct_vals and statistics.median(correct_vals) < thr:
            flags.append("FALSE-FAIL risk (correct performance scores below threshold)")
        if req and confusor_vals and statistics.median(confusor_vals) >= thr:
            flags.append("FALSE-PASS risk (confusor scores above threshold)")

        print(f"{name:<22}{str(req):<10}{thr:<11.2f}{_stats(correct_vals):<28}{_stats(confusor_vals):<28}{'; '.join(flags)}")
    print()


def main(sign_name: str = "COFFEE", camera_index: int = 0, calibrate: bool = False) -> None:
    if sign_name not in SIGNS:
        raise SystemExit(f"Unknown sign '{sign_name}'. Known: {list(SIGNS)}")
    sign = SIGNS[sign_name]

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise SystemExit(f"Could not open webcam (index {camera_index}). Try --camera 1.")

    buffer = RollingBuffer(window_seconds=2.0)
    t0 = time.monotonic()

    win = f"ASL_Game Phase 3 - verify {sign_name} (q to quit)"
    if calibrate:
        win = f"ASL_Game calibration - {sign_name} (1=correct 2=confusor q=quit+report)"
        print(f"[calibrate] running for sign {sign_name}. Press '1' to record CORRECT, "
              f"'2' to record CONFUSOR, 'q' to quit and print the report.")
    else:
        print(f"[demo_verify] running for sign {sign_name}; press 'q' in the window to quit.")
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setWindowProperty(win, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

    phase = "idle"  # idle | correct | confusor
    log_rows: list[dict] = []
    frame_idx = {"correct": 0, "confusor": 0}

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

            result = verify(buffer, sign)
            _draw_scorecard(bgr, result, movement_debug(buffer, sign), location_debug(buffer, sign))

            if calibrate:
                _draw_calibration_banner(bgr, phase)
                if phase in ("correct", "confusor"):
                    for p in result.params:
                        log_rows.append({
                            "phase": phase,
                            "frame_idx": frame_idx[phase],
                            "param_name": p.name,
                            "score": p.score,
                            "threshold": p.threshold,
                            "required": p.required,
                        })
                    frame_idx[phase] += 1

            cv2.imshow(win, bgr)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if calibrate:
                if key == ord("1"):
                    phase = "idle" if phase == "correct" else "correct"
                elif key == ord("2"):
                    phase = "idle" if phase == "confusor" else "confusor"

    cap.release()
    cv2.destroyAllWindows()

    if calibrate:
        param_names, thresholds, required = [], {}, {}
        for p in verify(buffer, sign).params:
            param_names.append(p.name)
            thresholds[p.name] = p.threshold
            required[p.name] = p.required
        _report_and_save(sign_name, log_rows, param_names, thresholds, required)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sign", default="COFFEE", help="sign name from the registry (COFFEE, LETTER_A)")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    ap.add_argument("--calibrate", action="store_true",
                     help="log per-parameter score distributions for a correct vs confusor run (see module docstring)")
    args = ap.parse_args()
    main(args.sign, args.camera, args.calibrate)
