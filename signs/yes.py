"""YES sign.

A fist 'nodding' up and down (like a head nodding yes). Movement is REPEATED. Distinguished from
HELLO (also repeated) by the fist handshape vs HELLO's open hand.
"""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

YES = Sign(
    name="YES",
    two_handed=False,
    dominant=HandShapeReq(kind="fist", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False, min_confidence=0.45),
    movement=MovementReq(kind=MovementKind.REPEATED, actor=DOMINANT, min_cycles=2, min_duration_s=0.6, required=True, min_confidence=0.25),
)
