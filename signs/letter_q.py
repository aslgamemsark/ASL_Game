"""Fingerspelled letter Q — same handshape as G, rotated to point downward, held still."""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_Q = Sign(
    name="LETTER_Q",
    two_handed=False,
    # A real recorded Q measured thumb-extension at ~0.48 against the default 0.6 threshold —
    # pointing the whole hand downward compresses how far the thumb reaches from the camera's
    # perspective (the same shared _thumb_extended check that works fine for G/L/Y upright). The
    # orientation + index-extension checks still reject a wrong-orientation confusor, so lowering
    # just this sign's own threshold is safe without touching the shared predicate.
    dominant=HandShapeReq(kind="q", required=True, min_confidence=0.4),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
