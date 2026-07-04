"""Generate synthetic classroom fixtures (correct + confusor), same technique as
make_synth_fixtures.py — TEACHER, WRITE, READ, NAME, FRIEND.

Run once: python -m tools.make_classroom_fixtures
Then copy the ten new JSON files into web/tests/fixtures/ so both suites share them (same
convention as every other sign's fixtures — see tests/fixtures/more_correct.json).
"""
from __future__ import annotations

import math

import numpy as np

from tools.make_synth_fixtures import CX, Y_CHEST, Y_FOREHEAD, N, T, make_hand, _frame, _write, _progress


def _ts():
    return [i * (T / (N - 1)) for i in range(N)]


def teacher_clip(mode):
    ndom = np.array([CX + 60.0, Y_FOREHEAD])          # other hand at the opposite temple, held
    out = []
    for t in _ts():
        dx = 35.0 * math.sin(2 * math.pi * 1.2 * t) if mode == "correct" else 0.0
        dom = np.array([CX - 60.0 + dx, Y_FOREHEAD])
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", ndom.copy(), "open")]))
    return out


def write_clip(mode):
    ndom = np.array([CX, Y_CHEST])                     # open palm held still
    out = []
    for t in _ts():
        dx = 25.0 * math.sin(2 * math.pi * 1.5 * t) if mode == "correct" else 0.0
        dom = np.array([CX + dx, Y_CHEST - 10.0])       # index hand scribbles across the palm
        out.append(_frame(t, [make_hand("Right", dom, "index"), make_hand("Left", ndom.copy(), "open")]))
    return out


def read_clip(mode):
    ndom = np.array([CX, Y_CHEST])                      # open palm held still (the "page")
    out = []
    for i, t in enumerate(_ts()):
        fr = _progress(i, mode)
        dom = np.array([CX, (Y_CHEST - 40.0) + 80.0 * fr])  # V-hand sweeps from above to below the palm
        out.append(_frame(t, [make_hand("Right", dom, "v"), make_hand("Left", ndom.copy(), "open")]))
    return out


def name_clip(mode):
    ndom = np.array([CX + 15.0, Y_CHEST])
    out = []
    for t in _ts():
        dy = 20.0 * math.sin(2 * math.pi * 1.5 * t) if mode == "correct" else 0.0
        dom = np.array([CX - 15.0, Y_CHEST + dy])       # H-hands cross and tap
        out.append(_frame(t, [make_hand("Right", dom, "h"), make_hand("Left", ndom.copy(), "h")]))
    return out


def friend_clip(mode):
    ndom = np.array([CX + 12.0, Y_CHEST + 20.0])
    out = []
    for t in _ts():
        dy = 18.0 * math.sin(2 * math.pi * 1.4 * t) if mode == "correct" else 0.0
        dom = np.array([CX - 12.0, Y_CHEST + 20.0 + dy])  # hooked index fingers tap together
        out.append(_frame(t, [make_hand("Right", dom, "index"), make_hand("Left", ndom.copy(), "index")]))
    return out


BUILDERS = {
    "teacher": ("TEACHER", teacher_clip),
    "write": ("WRITE", write_clip),
    "read": ("READ", read_clip),
    "name": ("NAME", name_clip),
    "friend": ("FRIEND", friend_clip),
}


def main() -> None:
    for base, (sign_name, builder) in BUILDERS.items():
        _write(f"{base}_correct", sign_name, builder("correct"))
        _write(f"{base}_confusor", sign_name, builder("confusor"))


if __name__ == "__main__":
    main()
