"""Fingerspelled letter X — index finger hooked into a hook shape, other fingers curled."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_X = Sign(
    name="LETTER_X",
    two_handed=False,
    dominant=HandShapeReq(kind="x", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
