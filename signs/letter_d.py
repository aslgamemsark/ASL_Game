"""Fingerspelled letter D — index extended up, other fingers curl toward the thumb, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_D = Sign(
    name="LETTER_D",
    two_handed=False,
    dominant=HandShapeReq(kind="d", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
