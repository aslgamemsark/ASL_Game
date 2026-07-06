"""Fingerspelled letter J — pinky extended (I handshape), traces a J arc in the air.

Motion: hand starts with pinky pointing up, swings downward, then hooks left/counterclockwise
at the bottom — tracing the shape of the letter J. Two-phase TRACED movement:
  phase 1 (90°) — downward stroke
  phase 2 (180°) — leftward hook at the bottom
"""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_J = Sign(
    name="LETTER_J",
    two_handed=False,
    dominant=HandShapeReq(kind="i", required=True, min_confidence=0.5),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(
        kind=MovementKind.TRACED,
        actor=DOMINANT,
        trace_template=(90.0, 180.0),   # down, then hook left
        trace_tolerance_deg=65.0,
        min_displacement_ratio=0.20,    # total path length, not net displacement
        min_duration_s=0.5,
        required=True,
    ),
)
