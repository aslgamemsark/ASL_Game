"""Fingerspelled letter K — index and middle spread apart, thumb touching middle's base, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_K = Sign(
    name="LETTER_K",
    two_handed=False,
    dominant=HandShapeReq(kind="k", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
