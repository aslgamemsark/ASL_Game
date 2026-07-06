"""Fingerspelled letter T — closed fist with the thumb tucked between the index and middle knuckles, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_T = Sign(
    name="LETTER_T",
    two_handed=False,
    dominant=HandShapeReq(kind="t", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
