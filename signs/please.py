"""PLEASE sign definition.

PLEASE = a flat/open hand on the chest, rubbing in a circle. One hand, open palm (facing the
chest), circular movement. Movement is REQUIRED (it's a circular sign), so the schema guards it
the same way it guards COFFEE.

Parameters declared:
  - handshape (dominant): open / flat hand        [required]
  - location: neutral space (on the chest)        [required, loose]
  - movement: circular on the chest               [required]
  - orientation: palm toward the body (in)        [not required in v1]
"""
from core.schema import (
    DOMINANT,
    Anchor,
    HandShapeReq,
    LocationReq,
    MovementKind,
    MovementReq,
    OrientationReq,
    PalmFacing,
    Sign,
)

PLEASE = Sign(
    name="PLEASE",
    two_handed=False,
    dominant=HandShapeReq(kind="open", required=True),
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.CHEST,     # specifically the chest, not just "somewhere on the torso"
        acting_hand=DOMINANT,
        max_dist_ratio=0.45,     # horizontal tolerance; vertical chest-height band is in the verifier
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.CIRCULAR,
        actor=DOMINANT,
        min_total_rotation_deg=300.0,   # a chest circle is gentler than COFFEE's grind
        radius_tolerance_ratio=1.0,
        min_duration_s=0.6,
        required=True, min_confidence=0.44),
    orientation=OrientationReq(hand=DOMINANT, facing=PalmFacing.IN, required=False, min_confidence=0.25),
)
