"""Fingerspelled letter S — closed fist with thumb wrapped across the front of the fingers."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_S = Sign(
    name="LETTER_S",
    two_handed=False,
    dominant=HandShapeReq(kind="letter_s", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
