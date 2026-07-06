"""Confusor tests for Phase 2 fingerspelling letters: G, H, K, N, P, Q, R, U.

These letters need geometry beyond finger extension: G/H/P/Q depend on whole-hand ORIENTATION
(sideways/downward vs upright), K/P need the thumb touching a specific knuckle (not a fingertip),
R needs the index/middle fingers actually crossed, and N needs the thumb tucked at a specific
depth under the fingers (the same class of ambiguity flagged as a known limitation for T).
"""
from __future__ import annotations

import numpy as np

from core.handshape import handshape_confidence
from core.landmarks import (
    Frame, Hand, RollingBuffer,
    WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP,
    RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP,
)
from core.verifier import verify
from signs import LETTER_G, LETTER_H, LETTER_K, LETTER_N, LETTER_P, LETTER_Q, LETTER_R, LETTER_U

S = 60.0
_MCP = {"index": (INDEX_MCP, -0.30), "middle": (MIDDLE_MCP, -0.10),
        "ring": (RING_MCP, 0.10), "pinky": (PINKY_MCP, 0.30)}
_TIP = {"index": INDEX_TIP, "middle": MIDDLE_TIP, "ring": RING_TIP, "pinky": PINKY_TIP}
# PIP indices parallel to _TIP — needed for _p_thumb_pos (checks thumb dist to MIDDLE_PIP)
_PIP = {"middle": MIDDLE_PIP}


def make_hand(center, curls=None, thumb_offset=(-1.0, 0.0), rotate_deg=0.0, handed="Right", spread_mult=1.0) -> Hand:
    """Same builder as test_letters_dfot.py, plus a whole-hand rotation (about the wrist) for the
    orientation-dependent letters, and a `spread_mult` widening (>1) or narrowing (<1) the
    index/middle tip x-offset (needed for V/K's spread vs H/U's "together")."""
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
        tip_fx = fx * spread_mult if name in ("index", "middle") else fx
        tip_y = extended_y + c * (curled_y - extended_y)
        pts[tip_idx, :2] = [cx + tip_fx * S, tip_y]
        if name in _PIP:
            pip_idx = _PIP[name]
            pip_x = (pts[mcp_idx, 0] + (cx + tip_fx * S)) / 2.0
            pip_y = (pts[mcp_idx, 1] + tip_y) / 2.0
            pts[pip_idx, :2] = [pip_x, pip_y]
    pts[2, :2] = [cx - 0.3 * S, mcp_y]
    pts[THUMB_TIP, :2] = [cx + thumb_offset[0] * S, cy + thumb_offset[1] * S]

    if rotate_deg:
        origin = pts[WRIST, :2].copy()
        rad = np.radians(rotate_deg)
        rot = np.array([[np.cos(rad), -np.sin(rad)], [np.sin(rad), np.cos(rad)]])
        pts[:, :2] = (pts[:, :2] - origin) @ rot.T + origin
    return Hand(handed, pts)


def _static_buffer(hand_factory):
    buf = RollingBuffer(2.0)
    for i in range(20):
        f = Frame(t=i * 0.1, width=640, height=480)
        f.hands.append(hand_factory((320, 240)))
        f.left_shoulder = np.array([260.0, 200.0]); f.right_shoulder = np.array([380.0, 200.0])
        buf.add(f)
    return buf


# --------------------------------------------------------------------------- G / Q (index+thumb, orientation)
def test_g_passes_sideways_rejects_upright():
    g = make_hand((0, 0), curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=90)
    assert handshape_confidence(g, "g") > 0.6
    upright = make_hand((0, 0), curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=0)
    assert handshape_confidence(upright, "g") < 0.6  # that's L, not G


def test_letter_g_sign_passes_and_rejects_l_orientation():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=90)
    ), LETTER_G)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=0)
    ), LETTER_G)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


def test_q_passes_downward_rejects_sideways():
    q = make_hand((0, 0), curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=180)
    assert handshape_confidence(q, "q") > 0.6
    g_orientation = make_hand((0, 0), curls={"middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=90)
    assert handshape_confidence(g_orientation, "q") < 0.6


# --------------------------------------------------------------------------- H / U (together, orientation)
def test_h_passes_sideways_rejects_upright():
    h = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=74.2, spread_mult=0.15)
    assert handshape_confidence(h, "letter_h") > 0.6
    upright = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=-15.8, spread_mult=0.15)
    assert handshape_confidence(upright, "letter_h") < 0.6  # that's U's orientation, not H


def test_letter_h_sign_passes_and_rejects_upright_orientation():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=74.2, spread_mult=0.15)
    ), LETTER_H)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=-15.8, spread_mult=0.15)
    ), LETTER_H)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


def test_u_passes_upright_rejects_spread():
    u = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=-15.8, spread_mult=0.15)
    assert handshape_confidence(u, "u") > 0.6
    v_shape = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=0, spread_mult=1.5)
    assert handshape_confidence(v_shape, "u") < 0.6  # real V (spread) must not pass as U


def test_letter_u_sign_passes_and_rejects_v():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=-15.8, spread_mult=0.15)
    ), LETTER_U)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.25, -0.10), rotate_deg=0, spread_mult=1.5)
    ), LETTER_U)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


# --------------------------------------------------------------------------- K / P (spread + thumb-touch, orientation)
def test_k_passes_with_its_handshape():
    k = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.15, -0.55), rotate_deg=0, spread_mult=1.5)
    assert handshape_confidence(k, "k") > 0.6


def test_k_rejects_plain_v():
    v = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=0, spread_mult=1.5)
    assert handshape_confidence(v, "k") < 0.6  # V's thumb isn't touching the middle base


def test_letter_k_sign_passes_and_rejects_v():
    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.15, -0.55), rotate_deg=0, spread_mult=1.5)
    ), LETTER_K)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(
        lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05), rotate_deg=0, spread_mult=1.5)
    ), LETTER_K)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


def test_p_passes_downward_rejects_upright():
    # thumb_offset=(-0.30, -0.65): after 180° rotation lands near MIDDLE_PIP (~0.25 units); upright fails
    p = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.30, -0.65), rotate_deg=180, spread_mult=1.5)
    assert handshape_confidence(p, "p") > 0.6
    k_orientation = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.30, -0.65), rotate_deg=0, spread_mult=1.5)
    assert handshape_confidence(k_orientation, "p") < 0.6


# --------------------------------------------------------------------------- R (crossed fingers)
def test_r_passes_when_crossed_rejects_v():
    crossed = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05))
    # simulate crossing by swapping index/middle tip x positions after building
    crossed.points[INDEX_TIP, 0], crossed.points[MIDDLE_TIP, 0] = (
        crossed.points[MIDDLE_TIP, 0], crossed.points[INDEX_TIP, 0]
    )
    assert handshape_confidence(crossed, "r") > 0.6

    v = make_hand((0, 0), curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05))
    assert handshape_confidence(v, "r") < 0.6  # uncrossed V must not pass as R


def test_letter_r_sign_passes_and_rejects_v():
    def crossed_factory(c):
        h = make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05))
        h.points[INDEX_TIP, 0], h.points[MIDDLE_TIP, 0] = h.points[MIDDLE_TIP, 0], h.points[INDEX_TIP, 0]
        return h

    result = verify(_static_buffer(crossed_factory), LETTER_R)
    assert result.passed, result.failing_required

    result = verify(_static_buffer(lambda c: make_hand(c, curls={"ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.05))), LETTER_R)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required


# --------------------------------------------------------------------------- N (fist, thumb depth — high risk)
def test_n_passes_with_its_handshape():
    n = make_hand((0, 0), curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-0.08, -0.30))
    assert handshape_confidence(n, "letter_n") > 0.6


def test_n_rejects_a_handshape():
    a = make_hand((0, 0), curls={"index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0}, thumb_offset=(-1.0, -0.10))
    assert handshape_confidence(a, "letter_n") < 0.6
