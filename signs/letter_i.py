"""Fingerspelled letter I — pinky extended, thumb and other fingers curled, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_I = Sign(
    name="LETTER_I",
    two_handed=False,
    dominant=HandShapeReq(kind="i", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
