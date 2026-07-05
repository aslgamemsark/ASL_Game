"""Fingerspelled letter P — same handshape as K, rotated to point downward, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_P = Sign(
    name="LETTER_P",
    two_handed=False,
    # A real recorded P measured middle-finger extension at ~0.47 against the default 0.6
    # threshold — fully extending the middle finger while pointing the whole hand downward is
    # measurably harder than doing the same K shape upright. The orientation + spread + thumb
    # checks still reject a wrong-orientation confusor, so lowering just this sign's own threshold
    # is safe.
    dominant=HandShapeReq(kind="p", required=True, min_confidence=0.4),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
