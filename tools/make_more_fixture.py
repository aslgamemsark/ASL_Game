"""Generate synthetic MORE fixtures (correct + confusor), same technique as make_synth_fixtures.py.

MORE = two claw ("flattened O") hands converging until fingertips meet. The confusor freezes the
same claw handshape held apart with no motion — the anti-bug guarantee that a plausible static
pose can't bypass the movement gate (same pattern as PAIN's converge confusor).

Run once: python -m tools.make_more_fixture
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from tools.make_synth_fixtures import CX, Y_CHEST, N, T, make_hand

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def _ts():
    return [i * (T / (N - 1)) for i in range(N)]


def more_clip(mode: str) -> list:
    from core.landmarks import Frame

    dom0, ndom0 = np.array([CX - 110.0, Y_CHEST]), np.array([CX + 110.0, Y_CHEST])
    dom1, ndom1 = np.array([CX - 10.0, Y_CHEST]), np.array([CX + 10.0, Y_CHEST])
    out = []
    for i, t in enumerate(_ts()):
        fr = (i / (N - 1)) if mode == "correct" else 0.0
        dom = dom0 + (dom1 - dom0) * fr
        ndom = ndom0 + (ndom1 - ndom0) * fr
        out.append(Frame(
            t=t, width=640, height=480,
            hands=[make_hand("Right", dom, "claw"), make_hand("Left", ndom, "claw")],
            left_shoulder=np.array([CX - 120.0, 120.0]),
            right_shoulder=np.array([CX + 120.0, 120.0]),
            mouth=np.array([CX, 12.0]),
        ))
    return out


def _write(name: str, frames: list) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = {"sign_name": "MORE", "synthetic": True, "frames": [f.to_dict() for f in frames]}
    with open(OUT / f"{name}.json", "w") as fh:
        json.dump(data, fh)
    print(f"wrote {name}.json  ({len(frames)} frames, {frames[-1].t - frames[0].t:.1f}s)")


def main() -> None:
    _write("more_correct", more_clip("correct"))
    _write("more_confusor", more_clip("confusor"))


if __name__ == "__main__":
    main()
