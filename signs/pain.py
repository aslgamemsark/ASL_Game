"""PAIN (HURT) — two index fingers converging toward each other.

ASL PAIN: both hands make a "1"/index handshape, fingertips pointing toward each other, and the
hands move toward each other near the body part that hurts. The verifiable feature for rule-based
v1 is the CONVERGENCE: the inter-hand gap must shrink over the rolling window.

Movement kind is CONVERGE (hospital addition to the engine), so holding two motionless index
fingers apart fails on movement — the same anti-bug guarantee as HELP, expressed with a
two-hand closing motion instead of a one-hand rise.

Parameters declared:
  handshape_dominant   : index finger extended        [required]
  handshape_nondominant: index finger extended        [required]
  location             : neutral space                [not gated — PAIN is signed at the hurt area]
  movement             : both hands CONVERGE          [required]  <- anti-bug gate
  orientation          : not gated in v1
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

PAIN = Sign(
    name="PAIN",
    two_handed=True,
    dominant=HandShapeReq(kind="index", required=True, min_confidence=0.25),
    nondominant=HandShapeReq(kind="index", required=True, min_confidence=0.25),
    location=LocationReq(
        anchor=Anchor.NEUTRAL_SPACE,
        acting_hand=DOMINANT,
        max_dist_ratio=1.5,
        required=False,            # PAIN is signed at the painful area — location varies
    ),
    movement=MovementReq(
        kind=MovementKind.CONVERGE,
        actor=DOMINANT,
        min_approach_ratio=0.15,   # gap must close by ~0.15 shoulder widths
        min_duration_s=0.4,
        required=True, min_confidence=0.25),
)
