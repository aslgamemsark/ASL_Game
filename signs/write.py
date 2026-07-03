"""WRITE — a pinched dominant hand scribbles repeatedly across the non-dominant palm.

ASL WRITE: the dominant hand (pinched fingers, like holding a pen) moves back and forth across
the upturned non-dominant palm, tip "touching down" as it goes. The repeated back-and-forth
motion over the palm is the defining, verifiable feature.

v1 simplification: the pinched "pen-holding" handshape is approximated as "index" (the rule
engine has no pinch/O predicate yet) — same category of approximation as MEDICINE's claw-for-
middle-finger. The REPEATED oscillation over the palm carries the real discrimination.

Parameters declared:
  handshape_dominant   : index (pen-hold approximated)     [required]
  handshape_nondominant: open, upward palm (the "page")    [required]
  location              : dominant hand on/near the palm    [required]
  movement               : dominant hand scribbles, REPEATED [required]  <- anti-bug gate
  orientation             : nondominant palm faces up        [not gated in v1]
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

WRITE = Sign(
    name="WRITE",
    two_handed=True,
    dominant=HandShapeReq(kind="index", required=True, min_confidence=0.5),
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.5,
        min_dist_ratio=0.0,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        min_cycles=2,
        min_amplitude_ratio=0.05,
        min_duration_s=0.5,
        required=True,
    ),
    orientation=OrientationReq(hand=NONDOMINANT, facing=PalmFacing.UP, required=False),
)
