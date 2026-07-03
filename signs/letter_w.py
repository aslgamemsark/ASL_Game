"""Fingerspelled letter W — index, middle, ring up, thumb + pinky curled, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_W = Sign(
    name="LETTER_W",
    two_handed=False,
    dominant=HandShapeReq(kind="w", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
