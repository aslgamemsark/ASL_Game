"""Fingerspelled letter Z — index extended, traces a Z zigzag in the air.

Motion: hand moves right, then diagonal down-left, then right again — three-phase TRACED
movement matching the shape of the letter Z:
  phase 1 (0°)   — rightward stroke
  phase 2 (135°) — diagonal down-left stroke
  phase 3 (0°)   — rightward stroke again
"""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

LETTER_Z = Sign(
    name="LETTER_Z",
    two_handed=False,
    dominant=HandShapeReq(kind="index", required=True, min_confidence=0.6),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(
        kind=MovementKind.TRACED,
        actor=DOMINANT,
        trace_template=(0.0, 135.0, 0.0),   # right, diagonal down-left, right
        trace_tolerance_deg=60.0,
        min_displacement_ratio=0.25,         # total path length across all three strokes
        min_duration_s=0.6,
        required=True,
    ),
)
