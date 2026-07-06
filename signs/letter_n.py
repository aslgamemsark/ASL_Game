"""Fingerspelled letter N — closed fist with the thumb tucked under the index and middle fingers, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_N = Sign(
    name="LETTER_N",
    two_handed=False,
    dominant=HandShapeReq(kind="letter_n", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
