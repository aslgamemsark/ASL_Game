"""Calibration edge-case fixtures for the classroom signs + new fingerspelling letters.

`tools/make_classroom_fixtures.py` and `tools/make_synth_fixtures.py` already cover the baseline
"correct" and "frozen" (movement=0) confusor for every sign. This module adds the edge cases that
distinguish "clears the movement gate" from "is actually the right sign" — the two failure modes
CLAUDE.md calls out as the ones a rule engine has to reject on their own terms, not by proxy:

  - idle       : correct-ish handshape held with small incidental jitter, no real sign progress
                 (the "present but not signing" case already used for HELP/PAIN/MEDICINE/EMERGENCY).
  - wrong_shape: the sign's real movement/location, performed with a DIFFERENT handshape.
  - wrong_dir  : (READ only) the real handshape/location, moved in the WRONG direction.
  - one_hand   : a two-handed sign with the nondominant hand entirely absent from every frame.
  - too_far    : (tap/other-hand signs) correct handshapes and movement, but the hands never
                 actually come close enough to satisfy the location gate.
  - LETTER_I/LETTER_W get their own confusors: the specific neighboring handshape a learner is
    most likely to substitute (Y-hand for I, V/open/fist for W), per each sign's own docstring.

Run once: python -m tools.make_calibration_fixtures
Then mirror into web/tests/fixtures/ (same convention as every other fixture set).
"""
from __future__ import annotations

import math

import numpy as np

from tools.make_synth_fixtures import CX, Y_CHEST, Y_FOREHEAD, N, T, make_hand, _frame, _write, _jit


def _ts():
    return [i * (T / (N - 1)) for i in range(N)]


# --------------------------------------------------------------------------- TEACHER
def teacher_idle():
    ndom0 = np.array([CX + 60.0, Y_FOREHEAD])
    dom0 = np.array([CX - 60.0, Y_FOREHEAD])
    out = []
    for t in _ts():
        out.append(_frame(t, [make_hand("Right", dom0 + _jit(), "open"), make_hand("Left", ndom0 + _jit(), "open")]))
    return out


def teacher_wrong_shape():
    """Real outward-from-forehead movement, but fists instead of open hands."""
    ndom = np.array([CX + 60.0, Y_FOREHEAD])
    out = []
    for t in _ts():
        dx = 35.0 * math.sin(2 * math.pi * 1.2 * t)
        dom = np.array([CX - 60.0 + dx, Y_FOREHEAD])
        out.append(_frame(t, [make_hand("Right", dom, "fist"), make_hand("Left", ndom.copy(), "fist")]))
    return out


def teacher_wrong_location():
    """Real open-hand outward movement, but performed at the chest, not the forehead."""
    ndom = np.array([CX + 60.0, Y_CHEST])
    out = []
    for t in _ts():
        dx = 35.0 * math.sin(2 * math.pi * 1.2 * t)
        dom = np.array([CX - 60.0 + dx, Y_CHEST])
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", ndom.copy(), "open")]))
    return out


def teacher_one_hand():
    """Correct dominant-hand motion at the forehead, but the nondominant hand never appears."""
    out = []
    for t in _ts():
        dx = 35.0 * math.sin(2 * math.pi * 1.2 * t)
        dom = np.array([CX - 60.0 + dx, Y_FOREHEAD])
        out.append(_frame(t, [make_hand("Right", dom, "open")]))
    return out


# --------------------------------------------------------------------------- WRITE
def write_idle():
    ndom0 = np.array([CX, Y_CHEST])
    dom0 = np.array([CX, Y_CHEST - 10.0])
    out = []
    for t in _ts():
        out.append(_frame(t, [make_hand("Right", dom0 + _jit(), "index"), make_hand("Left", ndom0 + _jit(), "open")]))
    return out


def write_wrong_shape():
    """Real scribbling motion over the palm, but an open hand instead of the pinch/index shape."""
    ndom = np.array([CX, Y_CHEST])
    out = []
    for t in _ts():
        dx = 25.0 * math.sin(2 * math.pi * 1.5 * t)
        dom = np.array([CX + dx, Y_CHEST - 10.0])
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", ndom.copy(), "open")]))
    return out


def write_one_hand():
    out = []
    for t in _ts():
        dx = 25.0 * math.sin(2 * math.pi * 1.5 * t)
        dom = np.array([CX + dx, Y_CHEST - 10.0])
        out.append(_frame(t, [make_hand("Right", dom, "index")]))
    return out


# --------------------------------------------------------------------------- READ
def read_idle():
    ndom0 = np.array([CX, Y_CHEST])
    dom0 = np.array([CX, Y_CHEST - 40.0])
    out = []
    for t in _ts():
        out.append(_frame(t, [make_hand("Right", dom0 + _jit(), "v"), make_hand("Left", ndom0 + _jit(), "open")]))
    return out


def read_wrong_direction():
    """Real V-hand + palm location, but the sweep goes UP instead of down."""
    ndom = np.array([CX, Y_CHEST])
    out = []
    for i, t in enumerate(_ts()):
        fr = i / (N - 1)
        dom = np.array([CX, (Y_CHEST + 40.0) - 80.0 * fr])  # starts below palm, sweeps upward
        out.append(_frame(t, [make_hand("Right", dom, "v"), make_hand("Left", ndom.copy(), "open")]))
    return out


def read_wrong_shape():
    """Real downward sweep over the palm, but a single-finger point instead of a V-hand."""
    ndom = np.array([CX, Y_CHEST])
    out = []
    for i, t in enumerate(_ts()):
        fr = i / (N - 1)
        dom = np.array([CX, (Y_CHEST - 40.0) + 80.0 * fr])
        out.append(_frame(t, [make_hand("Right", dom, "point"), make_hand("Left", ndom.copy(), "open")]))
    return out


def read_one_hand():
    out = []
    for i, t in enumerate(_ts()):
        fr = i / (N - 1)
        dom = np.array([CX, (Y_CHEST - 40.0) + 80.0 * fr])
        out.append(_frame(t, [make_hand("Right", dom, "v")]))
    return out


# --------------------------------------------------------------------------- NAME
def name_idle():
    ndom0 = np.array([CX + 15.0, Y_CHEST])
    dom0 = np.array([CX - 15.0, Y_CHEST])
    out = []
    for t in _ts():
        out.append(_frame(t, [make_hand("Right", dom0 + _jit(), "h"), make_hand("Left", ndom0 + _jit(), "h")]))
    return out


def name_wrong_shape():
    """Real crossed tap motion, but fists instead of H-hands."""
    ndom = np.array([CX + 15.0, Y_CHEST])
    out = []
    for t in _ts():
        dy = 20.0 * math.sin(2 * math.pi * 1.5 * t)
        dom = np.array([CX - 15.0, Y_CHEST + dy])
        out.append(_frame(t, [make_hand("Right", dom, "fist"), make_hand("Left", ndom.copy(), "fist")]))
    return out


def name_one_hand():
    out = []
    for t in _ts():
        dy = 20.0 * math.sin(2 * math.pi * 1.5 * t)
        dom = np.array([CX - 15.0, Y_CHEST + dy])
        out.append(_frame(t, [make_hand("Right", dom, "h")]))
    return out


def name_too_far():
    """Real H-hands and real repeated motion, but the hands stay far apart (never tap)."""
    ndom = np.array([CX + 220.0, Y_CHEST])
    out = []
    for t in _ts():
        dy = 20.0 * math.sin(2 * math.pi * 1.5 * t)
        dom = np.array([CX - 220.0, Y_CHEST + dy])
        out.append(_frame(t, [make_hand("Right", dom, "h"), make_hand("Left", ndom.copy(), "h")]))
    return out


# --------------------------------------------------------------------------- FRIEND
def friend_idle():
    ndom0 = np.array([CX + 12.0, Y_CHEST + 20.0])
    dom0 = np.array([CX - 12.0, Y_CHEST + 20.0])
    out = []
    for t in _ts():
        out.append(_frame(t, [make_hand("Right", dom0 + _jit(), "index"), make_hand("Left", ndom0 + _jit(), "index")]))
    return out


def friend_wrong_shape():
    """Real interlocking tap motion, but open hands instead of hooked index fingers."""
    ndom = np.array([CX + 12.0, Y_CHEST + 20.0])
    out = []
    for t in _ts():
        dy = 18.0 * math.sin(2 * math.pi * 1.4 * t)
        dom = np.array([CX - 12.0, Y_CHEST + 20.0 + dy])
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", ndom.copy(), "open")]))
    return out


def friend_one_hand():
    out = []
    for t in _ts():
        dy = 18.0 * math.sin(2 * math.pi * 1.4 * t)
        dom = np.array([CX - 12.0, Y_CHEST + 20.0 + dy])
        out.append(_frame(t, [make_hand("Right", dom, "index")]))
    return out


def friend_too_far():
    ndom = np.array([CX + 200.0, Y_CHEST + 20.0])
    out = []
    for t in _ts():
        dy = 18.0 * math.sin(2 * math.pi * 1.4 * t)
        dom = np.array([CX - 200.0, Y_CHEST + 20.0 + dy])
        out.append(_frame(t, [make_hand("Right", dom, "index"), make_hand("Left", ndom.copy(), "index")]))
    return out


# --------------------------------------------------------------------------- MORE
def more_idle():
    dom0 = np.array([CX - 90.0, Y_CHEST])
    ndom0 = np.array([CX + 90.0, Y_CHEST])
    out = []
    for t in _ts():
        out.append(_frame(t, [make_hand("Right", dom0 + _jit(), "claw"), make_hand("Left", ndom0 + _jit(), "claw")]))
    return out


def more_wrong_shape():
    """Real converging motion, but open hands instead of claw (flattened-O)."""
    dom0, ndom0 = np.array([CX - 100.0, Y_CHEST]), np.array([CX + 100.0, Y_CHEST])
    dom1, ndom1 = np.array([CX - 20.0, Y_CHEST]), np.array([CX + 20.0, Y_CHEST])
    out = []
    for i, t in enumerate(_ts()):
        fr = i / (N - 1)
        dom = dom0 + (dom1 - dom0) * fr
        ndom = ndom0 + (ndom1 - ndom0) * fr
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", ndom, "open")]))
    return out


def more_one_hand():
    dom0, dom1 = np.array([CX - 100.0, Y_CHEST]), np.array([CX - 20.0, Y_CHEST])
    out = []
    for i, t in enumerate(_ts()):
        fr = i / (N - 1)
        dom = dom0 + (dom1 - dom0) * fr
        out.append(_frame(t, [make_hand("Right", dom, "claw")]))
    return out


# --------------------------------------------------------------------------- LETTER_I / LETTER_W
def letter_i_correct():
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "i")]) for t in _ts()]


def letter_i_confusor_y():
    """The sign's own documented risk: a real Y-hand (thumb OUT + pinky) must not pass as I."""
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "y")]) for t in _ts()]


def letter_i_confusor_fist():
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "fist")]) for t in _ts()]


def letter_i_confusor_point():
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "point")]) for t in _ts()]


def letter_w_correct():
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "w")]) for t in _ts()]


def letter_w_confusor_v():
    """Two fingers (V/N/H family) instead of W's three — the closest neighboring letter shape."""
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "v")]) for t in _ts()]


def letter_w_confusor_open():
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "open")]) for t in _ts()]


def letter_w_confusor_fist():
    pos = np.array([CX, Y_CHEST])
    return [_frame(t, [make_hand("Right", pos.copy(), "fist")]) for t in _ts()]


BUILDERS = {
    "teacher_idle": teacher_idle,
    "teacher_wrong_shape": teacher_wrong_shape,
    "teacher_wrong_location": teacher_wrong_location,
    "teacher_one_hand": teacher_one_hand,
    "write_idle": write_idle,
    "write_wrong_shape": write_wrong_shape,
    "write_one_hand": write_one_hand,
    "read_idle": read_idle,
    "read_wrong_direction": read_wrong_direction,
    "read_wrong_shape": read_wrong_shape,
    "read_one_hand": read_one_hand,
    "name_idle": name_idle,
    "name_wrong_shape": name_wrong_shape,
    "name_one_hand": name_one_hand,
    "name_too_far": name_too_far,
    "friend_idle": friend_idle,
    "friend_wrong_shape": friend_wrong_shape,
    "friend_one_hand": friend_one_hand,
    "friend_too_far": friend_too_far,
    "more_idle": more_idle,
    "more_wrong_shape": more_wrong_shape,
    "more_one_hand": more_one_hand,
    "letter_i_correct": letter_i_correct,
    "letter_i_confusor_y": letter_i_confusor_y,
    "letter_i_confusor_fist": letter_i_confusor_fist,
    "letter_i_confusor_point": letter_i_confusor_point,
    "letter_w_correct": letter_w_correct,
    "letter_w_confusor_v": letter_w_confusor_v,
    "letter_w_confusor_open": letter_w_confusor_open,
    "letter_w_confusor_fist": letter_w_confusor_fist,
}

_SIGN_NAME = {
    "teacher": "TEACHER", "write": "WRITE", "read": "READ", "name": "NAME",
    "friend": "FRIEND", "more": "MORE", "letter_i": "LETTER_I", "letter_w": "LETTER_W",
}


def main() -> None:
    for fixture_name, builder in BUILDERS.items():
        base = next(k for k in _SIGN_NAME if fixture_name.startswith(k))
        _write(fixture_name, _SIGN_NAME[base], builder())


if __name__ == "__main__":
    main()
