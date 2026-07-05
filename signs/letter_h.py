"""Fingerspelled letter H — index and middle extended together, hand held sideways, still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_H = Sign(
    name="LETTER_H",
    two_handed=False,
    dominant=HandShapeReq(kind="letter_h", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
