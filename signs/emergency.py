"""EMERGENCY — one-handed rapid repeated shake.

ASL EMERGENCY: an "E" handshape (approximated as a claw in v1) is held up and shaken rapidly
side to side. The defining features are repetition AND frequency — a slow single wave is not
EMERGENCY. A higher min_cycles requirement (vs MEDICINE's 2) and a shorter min_duration_s
enforce the "rapid" character.

One-handed, which distinguishes it from two-handed MEDICINE even though both use a claw and a
REPEATED movement.

Parameters declared:
  handshape_dominant: claw (E-hand approximation)    [required]
  nondominant       : none (one-handed)
  location          : neutral space                  [not gated — raised hand, varies]
  movement          : rapid REPEATED side-to-side    [required]  <- anti-bug gate
  orientation       : not gated in v1
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

EMERGENCY = Sign(
    name="EMERGENCY",
    two_handed=False,
    # A vigorous single-arm shake naturally causes more counterbalance motion in the idle arm
    # than a calm one-handed sign — real calibration data (2026-07-15) showed the default
    # no_extra_hand floor scoring a genuine correct performance ~0.0 (a false-fail). Loosened
    # specifically for EMERGENCY rather than relaxing the shared default.
    extra_hand_motion_floor=0.55,
    dominant=HandShapeReq(kind="claw", required=True, min_confidence=0.50),
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.NEUTRAL_SPACE,
        acting_hand=DOMINANT,
        max_dist_ratio=1.5,
        required=False,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        min_cycles=3,              # more oscillations than MEDICINE -> "rapid"
        min_duration_s=0.5,        # shorter window -> must be fast
        required=True, min_confidence=0.25),
)
