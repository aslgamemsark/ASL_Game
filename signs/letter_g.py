"""Fingerspelled letter G — index extended sideways, thumb parallel beneath it, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_G = Sign(
    name="LETTER_G",
    two_handed=False,
    dominant=HandShapeReq(kind="g", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
