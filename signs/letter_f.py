"""Fingerspelled letter F — thumb and index tip touch, middle/ring/pinky extended, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_F = Sign(
    name="LETTER_F",
    two_handed=False,
    dominant=HandShapeReq(kind="f", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
