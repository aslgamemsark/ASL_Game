"""One-session recalibration pass for a specific set of signs.

Purpose: the reported bug isn't the already-tested "frozen pose" or "present but idle" confusor
(those are covered by <sign>_confusor.json / <sign>_idle.json and already fail correctly) — it's
that RAPID, undirected hand movement near the right location can rack up enough oscillation
cycles / net displacement / hand-to-hand convergence to clear the current (fairly loose)
min_cycles / min_amplitude_ratio / min_displacement_ratio / min_confidence floors, even though it
isn't the actual sign. There is no existing fixture or test for that confusor class.

For each sign this records THREE live takes:
  1. correct — perform the real sign, clearly, ~2 reps
  2. idle    — hands present near the right spot, doing NOTHING (refreshes the existing baseline)
  3. rapid   — move your hands FAST and randomly near the same spot — NOT the sign

...then prints a per-take, per-parameter report (same shape as record_calibration.py) so pass/fail
and the exact failing/passing parameter is visible immediately, without eyeballing a live overlay.

Fixtures are written to tests/fixtures/<sign>_{correct,idle,rapid}.json — correct/idle overwrite
the existing committed fixtures (refreshing them against a real, current take); rapid is new.

Run (venv active, models downloaded):
    python -m tools.recalibrate_words --sign DOCTOR,NURSE,MEDICINE,HOSPITAL,HELP,BREATHE,MORE,WRITE,LETTER_P
    python -m tools.recalibrate_words --sign DOCTOR --seconds 4
"""
from __future__ import annotations

import argparse

from core.landmarks import Frame, RollingBuffer
from core.recorder import record
from core.verifier import location_debug, movement_debug, verify
from signs import SIGNS

FIXTURES_DIR = "tests/fixtures"
TAKES = [
    ("correct", "Perform the REAL sign clearly, ~2 reps."),
    ("idle", "Hold your hands near the right spot but DO NOTHING."),
    ("rapid", "Move your hands FAST and randomly near the same spot — NOT the sign."),
]


def _report(frames: list[Frame], sign_name: str, kind: str) -> None:
    sign = SIGNS[sign_name]
    print(f"\n{'-' * 70}\n{sign_name} [{kind}]: {len(frames)} frames, "
          f"{sum(1 for f in frames if len(f.hands) >= 2)} with both hands")

    for window_s in (1.5, 2.5, 4.0):
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


def main(sign_names: list[str], seconds: float, camera_index: int) -> None:
    for sign_name in sign_names:
        if sign_name not in SIGNS:
            print(f"Skipping unknown sign '{sign_name}'. Known: {list(SIGNS)}")
            continue

        print(f"\n{'=' * 70}\n{sign_name}\n{'=' * 70}")
        results: dict[str, list[Frame]] = {}
        for kind, instruction in TAKES:
            out_path = f"{FIXTURES_DIR}/{sign_name.lower()}_{kind}.json"
            print(f"\n>>> {sign_name} / {kind}: {instruction}")
            print(f"    preview window opening — SPACE to record ({seconds:.0f}s), q to skip.", flush=True)
            frames = record(out_path, seconds=seconds, camera_index=camera_index,
                             sign_name=sign_name, instruction=f"[{kind.upper()}] {instruction}")
            if not frames:
                print(f"{sign_name}/{kind}: skipped/cancelled.")
                continue
            results[kind] = frames

        for kind, _ in TAKES:
            if kind in results:
                _report(results[kind], sign_name, kind)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sign", required=True,
                     help="comma-separated sign names, e.g. DOCTOR,NURSE,MEDICINE")
    ap.add_argument("--seconds", type=float, default=4.0, help="recording length per take")
    ap.add_argument("--camera", type=int, default=0, help="webcam index")
    args = ap.parse_args()
    main([s.strip().upper() for s in args.sign.split(",")], args.seconds, args.camera)
