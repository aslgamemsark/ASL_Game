"""DIZZY sign definition.

ASL DIZZY: a hand circles in front of the face (a small loop), with an unfocused facial
expression selling it.

v1: gated as a clawed/loose hand up at the FACE making a CIRCULAR motion. The facial expression
(a non-manual marker) is NOT detectable from hand+pose landmarks, so it is described but ungated —
flagged for the future when NMM detection exists. The circle near the face distinguishes DIZZY
from the linear FEVER sweep.

Parameters:
  handshape (dominant): clawed / loose hand  [required]
  location: up in front of the face          [required]
  movement: a circular loop                  [required]
  NMM: unfocused expression                  [described, NOT gated in v1]
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

DIZZY = Sign(
    name="DIZZY",
    two_handed=False,
    dominant=HandShapeReq(kind="open", required=True, min_confidence=0.55),  # calibrated: signer circles an open hand, not a claw
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.FOREHEAD,      # "in front of the face" — at/above the mouth
        acting_hand=DOMINANT,
        max_dist_ratio=0.7,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.CIRCULAR,
        actor=DOMINANT,
        min_total_rotation_deg=270.0,   # a small loop in front of the face
        radius_tolerance_ratio=1.0,
        min_duration_s=0.6,
        required=True, min_confidence=0.34),
)
