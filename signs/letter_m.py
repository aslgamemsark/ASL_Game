"""Fingerspelled letter M — closed fist, thumb tucked under index, middle, and ring fingers."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_M = Sign(
    name="LETTER_M",
    two_handed=False,
    dominant=HandShapeReq(kind="m", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
