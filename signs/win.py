"""WIN sign definition.

ASL WIN (verified against Lifeprint): non-dominant hand holds a stationary "S" (fist) handshape in
front of the body. The dominant hand starts as a loose "5-claw" and sweeps inward and upward,
closing into an "S" (fist) as it lands above the non-dominant fist. This engine has no mid-sign
handshape-transition model (only one declared handshape per hand, held for the whole window), so
— matching the project's existing v1-approximation precedent (see DOCTOR, HELP) — both hands are
checked as the sign's ENDING handshape ("fist"), and the verifiable movement is the dominant
hand's upward sweep, landing above the stationary nondominant fist. This is the same
location/movement shape as COFFEE (OTHER_HAND anchor, vertical="above") but with an upward LINEAR
sweep instead of a circular grind.

Parameters declared:
  - handshape (both hands): fist (approximates the ending "S" handshape)  [required]
  - location: dominant ends above the stationary nondominant fist          [required]
  - movement: dominant sweeps upward                                      [required]
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

WIN = Sign(
    name="WIN",
    two_handed=True,
    dominant=HandShapeReq(kind="fist", required=True, min_confidence=0.5),
    nondominant=HandShapeReq(kind="fist", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.9,
        min_dist_ratio=0.0,
        vertical="above",     # dominant fist ends up above the stationary nondominant fist
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, -1.0),        # upward in image space (y decreases upward)
        min_displacement_ratio=0.2,
        min_duration_s=0.4,
        required=True, min_confidence=0.25,
    ),
)
