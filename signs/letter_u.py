"""Fingerspelled letter U — index and middle extended together, held upright and still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_U = Sign(
    name="LETTER_U",
    two_handed=False,
    dominant=HandShapeReq(kind="u", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
