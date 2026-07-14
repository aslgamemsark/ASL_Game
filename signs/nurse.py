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
        # Recalibrated 2026-07-14: min_confidence=0.25 was far looser than needed — correct NURSE
        # sustains the composite score at 1.0 for long streaks, so 0.25 bought nothing but easy
        # false positives. Raised to 0.6 (matching DOCTOR/HOSPITAL/MEDICINE/BREATHE) as a real, if
        # partial, tightening: a real recorded rapid/random-movement confusor still sustained a
        # false PASS at every threshold up to 1.0 in this engine (raw cycle-count and amplitude
        # both overlapped correct's own real-take range — a known rule-based-v1 ceiling, same class
        # as the DOCTOR/NURSE/BREATHE handshape ceiling noted in scenarios/hospital_shop/main.py).
        # The web app's trained classifier gate (knownSigns includes NURSE, not GATE_EXCLUDED_SIGNS)
        # is the actual backstop against this specific confusor class until this schema check can
        # incorporate more than position/cycle-count (e.g. a kinematic-regularity feature).
        required=True, min_confidence=0.6),
)
