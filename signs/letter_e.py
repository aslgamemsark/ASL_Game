"""Fingerspelled letter E — all four fingers bent at the middle knuckle, thumb tucked under."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_E = Sign(
    name="LETTER_E",
    two_handed=False,
    dominant=HandShapeReq(kind="e", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
