"""Non-manual marker (NMM) scoring tests.

No current sign requires an NMM (see core/schema.py's NmmReq docstring) — this proves the
scoring machinery itself is correct using a synthetic sign, and that adding face_blendshapes to
Frame/Sign is fully additive: every pre-existing sign's verification is untouched.
"""
from __future__ import annotations

import numpy as np

from core.landmarks import Frame, RollingBuffer
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementReq, NmmReq, Sign
from core.verifier import verify
from signs import HELLO
from tests.test_vocabulary import ALL, make_hand

BROWS_UP = Sign(
    name="_TEST_BROWS_UP",
    two_handed=False,
    dominant=HandShapeReq(kind="open", required=True),
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(required=False),
    nmm=NmmReq(blendshape="browInnerUp", min_score=0.5, required=False),
)


def _buffer(blendshape_score: float | None) -> RollingBuffer:
    buf = RollingBuffer(2.0)
    for i in range(20):
        fb = {"browInnerUp": blendshape_score} if blendshape_score is not None else None
        f = Frame(t=i * 0.1, width=640, height=480, face_blendshapes=fb)
        f.hands.append(make_hand((320, 240), ALL, thumb_out=True))  # open hand, clears BROWS_UP's handshape
        f.left_shoulder = np.array([260.0, 200.0])
        f.right_shoulder = np.array([380.0, 200.0])
        buf.add(f)
    return buf


class TestNmmScoring:
    def test_high_blendshape_score_clears_threshold(self):
        result = verify(_buffer(0.9), BROWS_UP)
        p = result.get("nmm")
        assert p is not None
        assert p.cleared, f"0.9 raw score / 0.5 min_score should clear: {p.score:.2f}"

    def test_low_blendshape_score_does_not_clear(self):
        result = verify(_buffer(0.1), BROWS_UP)
        p = result.get("nmm")
        assert p is not None
        assert not p.cleared, f"0.1 raw score / 0.5 min_score should not clear: {p.score:.2f}"

    def test_no_face_data_scores_zero_but_does_not_gate_pass(self):
        """No current NMM is required=True, so missing face data must never fail `passed`."""
        result = verify(_buffer(None), BROWS_UP)
        p = result.get("nmm")
        assert p is not None and p.score == 0.0
        assert result.passed, "an optional (not required) nmm must never block an overall pass"


class TestNmmIsFullyAdditive:
    """Every pre-existing sign has nmm=None — its verification must be byte-for-byte unaffected."""

    def test_hello_has_no_nmm_param(self):
        buf = RollingBuffer(2.0)
        result = verify(buf, HELLO)
        assert result.get("nmm") is None
