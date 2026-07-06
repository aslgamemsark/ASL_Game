"""HELP — flagship movement-required sign for the hospital scenario.

ASL HELP: the dominant hand (a thumb-up "A"/fist) rests on the open, upward non-dominant palm,
and the helping hand lifts upward ("lifting someone up").

This is the hospital analog of COFFEE — its defining feature is MOTION, so movement is required.
A learner who freezes the correct pose MUST fail on movement specifically (Phase 4 confusor test).

v1 simplification (calibrated live): the dominant handshape is "fist" rather than the strict "A".
The A-vs-fist minimal pair hinges on a reliably-detected extended thumb, which the rule-based
classifier can't hold steady while the hand is moving — it made HELP nearly impossible to pass.
A closed hand resting on the open palm and lifting is unambiguous within the hospital vocabulary
(no other hospital sign is a fist-on-palm lift), so we accept any closed fist here.

Parameters declared:
  handshape_dominant   : closed fist (the helping hand)    [required]
  handshape_nondominant: open/flat palm (the platform)     [required]
  location             : dominant hand on/near nondominant [required]
  movement             : dominant lifts upward (linear -y)  [required]  <- anti-bug gate
  orientation          : nondominant palm faces up          [not gated in v1]
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

HELP = Sign(
    name="HELP",
    two_handed=True,
    dominant=HandShapeReq(kind="fist", required=True, min_confidence=0.5),
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.60,             # roomy: the gap grows as the helping hand lifts off
        min_dist_ratio=0.0,
        vertical=None,
        required=True,
        min_confidence=0.44,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, -1.0),           # image-space up (y decreases upward)
        min_displacement_ratio=0.15,     # a DELIBERATE lift (~0.15 shoulder-widths), not a drift
        min_duration_s=0.4,
        # real hand-lifts are never perfectly straight, so linear_confidence caps ~0.55-0.75; 0.5
        # accepts a clear lift while a frozen/jittering hand still scores 0 (hard floor in movement.py).
        min_confidence=0.25,
        required=True,
    ),
    orientation=OrientationReq(hand=NONDOMINANT, facing=PalmFacing.UP, required=False, min_confidence=0.25),
)
