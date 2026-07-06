"""YOU sign — an index-finger point (toward the person). Handshape only in v1 (held still)."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

YOU = Sign(
    name="YOU",
    two_handed=False,
    dominant=HandShapeReq(kind="point", required=True, min_confidence=0.25),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
