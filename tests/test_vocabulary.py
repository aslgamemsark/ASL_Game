"""Tests for the expanded vocabulary: handshape discrimination + new sign confusors.

Synthesizes hands with chosen finger-extension patterns and verifies:
  - handshape_confidence tells the handshapes apart (V vs open, L vs point, Y, etc.),
  - each static letter sign passes with its handshape and fails with the wrong one,
  - the movement signs (HELLO/WANT/YES) fail on movement when the hand is held still.
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
from signs import HELLO, LETTER_B, LETTER_I, LETTER_L, LETTER_V, LETTER_W, LETTER_Y, WANT, YES, YOU

S = 60.0
_MCP = {"index": (INDEX_MCP, -0.30), "middle": (MIDDLE_MCP, -0.10),
        "ring": (RING_MCP, 0.10), "pinky": (PINKY_MCP, 0.30)}
_TIP = {"index": INDEX_TIP, "middle": MIDDLE_TIP, "ring": RING_TIP, "pinky": PINKY_TIP}


def make_hand(center, extended=(), thumb_out=False, handed="Right"):
    cx, cy = center
    pts = np.zeros((21, 3))
    pts[WRIST, :2] = [cx, cy + 0.5 * S]
    mcp_y = cy - 0.2 * S
    for name, (mcp_idx, fx) in _MCP.items():
        pts[mcp_idx, :2] = [cx + fx * S, mcp_y]
        tip_idx = _TIP[name]
        if name in extended:
            pts[tip_idx, :2] = [cx + fx * S, mcp_y - 0.9 * S]      # far from wrist = extended
        else:
            pts[tip_idx, :2] = [cx + fx * S, mcp_y + 0.15 * S]     # folded toward palm = curled
    pts[2, :2] = [cx - 0.3 * S, mcp_y]                             # thumb mcp
    pts[THUMB_TIP, :2] = [cx - 1.0 * S, mcp_y] if thumb_out else [cx - 0.25 * S, mcp_y + 0.1 * S]
    return Hand(handed, pts)


ALL = ("index", "middle", "ring", "pinky")


class TestHandshapeDiscrimination:
    def test_open_vs_fist(self):
        assert handshape_confidence(make_hand((0, 0), ALL, thumb_out=True), "open") > 0.6
        assert handshape_confidence(make_hand((0, 0), (), thumb_out=False), "fist") > 0.6
        assert handshape_confidence(make_hand((0, 0), (), thumb_out=False), "open") < 0.4

    def test_v(self):
        v = make_hand((0, 0), ("index", "middle"))
        assert handshape_confidence(v, "v") > 0.6
        assert handshape_confidence(v, "open") < 0.6          # below the pass threshold (ring/pinky curled)
        assert handshape_confidence(make_hand((0, 0), ALL, thumb_out=True), "v") < 0.5

    def test_point_vs_l(self):
        point = make_hand((0, 0), ("index",), thumb_out=False)
        ell = make_hand((0, 0), ("index",), thumb_out=True)
        assert handshape_confidence(point, "point") > 0.6
        assert handshape_confidence(ell, "l") > 0.6
        assert handshape_confidence(point, "l") < 0.6         # L needs the thumb out

    def test_y(self):
        y = make_hand((0, 0), ("pinky",), thumb_out=True)
        assert handshape_confidence(y, "y") > 0.6
        assert handshape_confidence(y, "v") < 0.5

    def test_w(self):
        w = make_hand((0, 0), ("index", "middle", "ring"))
        assert handshape_confidence(w, "w") > 0.6
        assert handshape_confidence(w, "v") < 0.6           # V needs ring curled

    def test_i_vs_y(self):
        # I is pinky-only with the thumb tucked in — must NOT be confused with Y (thumb+pinky).
        i = make_hand((0, 0), ("pinky",), thumb_out=False)
        y = make_hand((0, 0), ("pinky",), thumb_out=True)
        assert handshape_confidence(i, "i") > 0.6
        assert handshape_confidence(y, "i") < 0.6


def _static_buffer(hand_factory):
    buf = RollingBuffer(2.0)
    for i in range(20):
        f = Frame(t=i * 0.1, width=640, height=480)
        f.hands.append(hand_factory((320, 240)))
        f.left_shoulder = np.array([260.0, 200.0]); f.right_shoulder = np.array([380.0, 200.0])
        buf.add(f)
    return buf


class TestStaticLetters:
    def test_each_letter_passes_with_its_handshape(self):
        cases = [
            (LETTER_B, lambda c: make_hand(c, ALL, thumb_out=True)),
            (LETTER_V, lambda c: make_hand(c, ("index", "middle"))),
            (LETTER_L, lambda c: make_hand(c, ("index",), thumb_out=True)),
            (LETTER_Y, lambda c: make_hand(c, ("pinky",), thumb_out=True)),
            (LETTER_W, lambda c: make_hand(c, ("index", "middle", "ring"))),
            (LETTER_I, lambda c: make_hand(c, ("pinky",), thumb_out=False)),
            (YOU, lambda c: make_hand(c, ("index",), thumb_out=False)),
        ]
        for sign, factory in cases:
            assert verify(_static_buffer(factory), sign).passed, f"{sign.name} should pass"

    def test_wrong_handshape_fails(self):
        # a fist is not the letter V
        result = verify(_static_buffer(lambda c: make_hand(c, (), thumb_out=False)), LETTER_V)
        assert not result.passed
        assert "handshape_dominant" in result.failing_required

    def test_letter_i_rejects_letter_y_handshape(self):
        # Y (thumb+pinky out) must not accidentally pass as I (pinky only, thumb tucked).
        result = verify(_static_buffer(lambda c: make_hand(c, ("pinky",), thumb_out=True)), LETTER_I)
        assert not result.passed
        assert "handshape_dominant" in result.failing_required


def _moving_buffer(hand_factory, positions):
    buf = RollingBuffer(2.0)
    for i, pos in enumerate(positions):
        f = Frame(t=i * 0.05, width=640, height=480)
        f.hands.append(hand_factory(pos))
        if hand_factory.__name__ == "two":
            f.hands.append(make_hand((pos[0] + 120, pos[1]), ALL, thumb_out=True, handed="Left"))
        f.left_shoulder = np.array([260.0, 200.0]); f.right_shoulder = np.array([380.0, 200.0])
        buf.add(f)
    return buf


class TestMovementSignsRejectStillHands:
    def test_hello_still_fails_on_movement(self):
        still = _static_buffer(lambda c: make_hand(c, ALL, thumb_out=True))
        result = verify(still, HELLO)
        assert not result.passed and "movement" in result.failing_required

    def test_yes_still_fails_on_movement(self):
        still = _static_buffer(lambda c: make_hand(c, (), thumb_out=False))
        result = verify(still, YES)
        assert not result.passed and "movement" in result.failing_required
