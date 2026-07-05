"""Confusor tests for the four new fingerspelling letters D, F, O, T.

Each needs geometry finer than plain finger extension: D/F/O all involve the thumb touching (or
not touching) a specific fingertip, and T needs the thumb wedged between two knuckles — none of
which the existing test_vocabulary.py `make_hand` helper (extended/curled + thumb in/out) can
build. This file adds a small hand builder with a per-finger curl FRACTION and an explicit thumb
tip position, so each letter's defining geometry can be constructed directly.
"""
from __future__ import annotations

import numpy as np

from core.handshape import handshape_confidence
from core.landmarks import (
    Frame, Hand, RollingBuffer,
    WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_TIP,
    RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP,
)
from core.verifier import verify
from signs import LETTER_D, LETTER_F, LETTER_O, LETTER_T

S = 60.0
_MCP = {"index": (INDEX_MCP, -0.30), "middle": (MIDDLE_MCP, -0.10),
        "ring": (RING_MCP, 0.10), "pinky": (PINKY_MCP, 0.30)}
_TIP = {"index": INDEX_TIP, "middle": MIDDLE_TIP, "ring": RING_TIP, "pinky": PINKY_TIP}


def make_hand(center, curls: dict[str, float] | None = None, thumb_offset=(-1.0, 0.0), handed="Right") -> Hand:
    """`curls`: name -> curl fraction in [0,1] (0 = fully extended, 1 = fully curled). Missing
    fingers default to fully extended. `thumb_offset`: (dx, dy) from the wrist, in hand-scale S."""
    curls = curls or {}
    cx, cy = center
    pts = np.zeros((21, 3))
    pts[WRIST, :2] = [cx, cy + 0.5 * S]
    mcp_y = cy - 0.2 * S
    extended_y, curled_y = mcp_y - 0.9 * S, mcp_y + 0.15 * S
    for name, (mcp_idx, fx) in _MCP.items():
        pts[mcp_idx, :2] = [cx + fx * S, mcp_y]
        tip_idx = _TIP[name]
        c = curls.get(name, 0.0)
        pts[tip_idx, :2] = [cx + fx * S, extended_y + c * (curled_y - extended_y)]
    pts[2, :2] = [cx - 0.3 * S, mcp_y]  # thumb mcp
    pts[THUMB_TIP, :2] = [cx + thumb_offset[0] * S, cy + thumb_offset[1] * S]
    return Hand(handed, pts)


def _static_buffer(hand_factory):
    buf = RollingBuffer(2.0)
    for i in range(20):
        f = Frame(t=i * 0.1, width=640, height=480)
        f.hands.append(hand_factory((320, 240)))
        f.left_shoulder = np.array([260.0, 200.0]); f.right_shoulder = np.array([380.0, 200.0])
        buf.add(f)
    return buf


# --------------------------------------------------------------------------- D
def test_d_passes_with_its_handshape():
    d = make_hand((0, 0), curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10))
    assert handshape_confidence(d, "d") > 0.6


def test_d_rejects_l_handshape():
    # L: index extended, thumb held OUT to the side (not tucked) — must not read as D.
    ell = make_hand((0, 0), curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05))
    assert handshape_confidence(ell, "d") < 0.6


def test_letter_d_sign_passes_and_rejects_l():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10))
    ), LETTER_D)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05))
    ), LETTER_D)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


# --------------------------------------------------------------------------- F
def test_f_passes_with_its_handshape():
    # Index curled halfway in to meet the thumb; middle/ring/pinky fully extended.
    f = make_hand((0, 0), curls={"index": 0.5}, thumb_offset=(-0.45, -0.75))
    assert handshape_confidence(f, "f") > 0.6


def test_f_rejects_open_hand():
    open_hand = make_hand((0, 0), curls={}, thumb_offset=(-1.0, -0.05))
    assert handshape_confidence(open_hand, "f") < 0.6


def test_letter_f_sign_passes_and_rejects_open():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"index": 0.5}, thumb_offset=(-0.45, -0.75))
    ), LETTER_F)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={}, thumb_offset=(-1.0, -0.05))
    ), LETTER_F)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


# --------------------------------------------------------------------------- O
def test_o_passes_with_its_handshape():
    o = make_hand((0, 0), curls={"index": 0.65, "middle": 0.65, "ring": 0.65, "pinky": 0.65},
                  thumb_offset=(-0.15, -0.6))
    assert handshape_confidence(o, "o") > 0.6


def test_o_rejects_flat_open_hand():
    open_hand = make_hand((0, 0), curls={}, thumb_offset=(-1.0, -0.05))
    assert handshape_confidence(open_hand, "o") < 0.6


def test_o_rejects_full_fist():
    fist = make_hand((0, 0), curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
                     thumb_offset=(-0.25, -0.10))
    assert handshape_confidence(fist, "o") < 0.6


def test_letter_o_sign_passes_and_rejects_open():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"index": 0.65, "middle": 0.65, "ring": 0.65, "pinky": 0.65},
                            thumb_offset=(-0.15, -0.6))
    ), LETTER_O)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={}, thumb_offset=(-1.0, -0.05))
    ), LETTER_O)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


# --------------------------------------------------------------------------- T
def test_t_passes_with_its_handshape():
    t = make_hand((0, 0), curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
                 thumb_offset=(-0.1, -0.4))
    assert handshape_confidence(t, "t") > 0.6


def test_t_rejects_a_handshape():
    # A: same fist, but thumb held out alongside the index (not wedged between knuckles).
    a = make_hand((0, 0), curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
                 thumb_offset=(-1.0, -0.10))
    assert handshape_confidence(a, "t") < 0.6


def test_letter_t_sign_passes_and_rejects_a():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
                            thumb_offset=(-0.1, -0.4))
    ), LETTER_T)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
                            thumb_offset=(-1.0, -0.10))
    ), LETTER_T)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required
