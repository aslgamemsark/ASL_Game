"""READ — a V-hand sweeps downward over the non-dominant open palm, like eyes scanning a page.

ASL READ: the dominant hand forms a V (representing the eyes) and sweeps down over the open,
upward non-dominant palm (the "page"). The downward sweep near the other hand is the defining,
verifiable feature.

Parameters declared:
  handshape_dominant   : V (index + middle extended)        [required]
  handshape_nondominant: open, upward palm (the "page")     [required]
  location              : dominant hand on/near the palm     [required]
  movement               : dominant hand sweeps down, LINEAR  [required]  <- anti-bug gate
  orientation             : nondominant palm faces up         [not gated in v1]
"""
from core.schema import (
    DOMINANT,
    NONDOMINANT,
    Anchor,
    HandShapeReq,
    LocationReq,
    MovementKind,
    MovementReq,
    OrientationReq,
    PalmFacing,
    Sign,
)

READ = Sign(
    name="READ",
    two_handed=True,
    dominant=HandShapeReq(kind="v", required=True, min_confidence=0.25),
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.6,
        min_dist_ratio=0.0,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, 1.0),           # image-space down — camera-mirroring-independent, unlike left/right
        min_displacement_ratio=0.25,
        min_duration_s=0.4,
        required=True, min_confidence=0.34),
    orientation=OrientationReq(hand=NONDOMINANT, facing=PalmFacing.UP, required=False, min_confidence=0.25),
)
