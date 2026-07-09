"""RED sign definition.

ASL RED (verified against Lifeprint): dominant hand starts near the chin/lips in an index-finger
("1") handshape and slides downward, away from the mouth. Some signers close toward an "X"
handshape as they finish; this engine has no mid-sign handshape-transition model (same category of
simplification as WIN below), so the starting index handshape is what's checked throughout, per
the project's existing precedent for approximating one representative handshape. Location +
movement mirror THANK_YOU's chin-anchor + downward-linear pattern almost exactly, since both signs
start at the chin and pull down.

Parameters declared:
  - handshape (dominant): index                [required]
  - location: reached chin height (Anchor.CHIN) [required]
  - movement: linear, downward                 [required]
  - orientation: not gated in v1
"""
from core.schema import (
    DOMINANT,
    Anchor,
    HandShapeReq,
    LocationReq,
    MovementKind,
    MovementReq,
    Sign,
)

RED = Sign(
    name="RED",
    two_handed=False,
    dominant=HandShapeReq(kind="index", required=True),
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.CHIN,
        acting_hand=DOMINANT,
        max_dist_ratio=0.5,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, 1.0),          # downward in image space, same convention as THANK_YOU
        min_displacement_ratio=0.2,
        min_duration_s=0.4,
        required=True, min_confidence=0.25,
    ),
)
