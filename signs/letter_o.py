"""Fingerspelled letter O — all four fingertips curl in to meet the thumb, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_O = Sign(
    name="LETTER_O",
    two_handed=False,
    dominant=HandShapeReq(kind="o", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
