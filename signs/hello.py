"""HELLO sign (casual wave).

Open hand waving side to side near the head. Movement is REPEATED (oscillation). Handshape +
a repeated wave; location is left ungated (a wave reads the same anywhere in the upper space).
"""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

HELLO = Sign(
    name="HELLO",
    two_handed=False,
    dominant=HandShapeReq(kind="open", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False, min_confidence=0.45),
    movement=MovementReq(kind=MovementKind.REPEATED, actor=DOMINANT, min_cycles=2, min_duration_s=0.6, required=True, min_confidence=0.25),
)
