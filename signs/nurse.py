"""NURSE sign definition.

ASL NURSE: the "N" handshape (index + middle fingers together) taps the inside of the opposite
wrist twice — the same motion as DOCTOR, distinguished only by the handshape.

v1: "N" is recognised by finger count (exactly two extended fingers); the non-dominant hand
stands in for the wrist and is present but not gated. Minimal pair with DOCTOR (flat hand) — see
signs/doctor.py.

Parameters:
  handshape (dominant): "n" (two fingers)    [required]
  handshape (non-dom):  the wrist/arm        [present but NOT gated]
  location: near the non-dominant hand/wrist [required]
  movement: repeated taps toward the wrist   [required]
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

NURSE = Sign(
    name="NURSE",
    two_handed=True,
    dominant=HandShapeReq(kind="n", required=True, min_confidence=0.29),
    nondominant=HandShapeReq(kind="open", required=False),   # the wrist/arm — present, not gated
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        use_closest_approach=True,  # a wrist-TAP: the hands touch (closest points), centres stay far
        max_dist_ratio=0.35,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        min_cycles=2,
        min_duration_s=0.5,
        required=True, min_confidence=0.25),
)
