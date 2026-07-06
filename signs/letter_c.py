"""Fingerspelled letter C — all fingers and thumb curved into a C-shape, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_C = Sign(
    name="LETTER_C",
    two_handed=False,
    dominant=HandShapeReq(kind="c", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
