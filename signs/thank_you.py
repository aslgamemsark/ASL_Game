"""THANK YOU sign definition.

THANK YOU = a flat/open hand starting at the chin/lips, moving forward and DOWN toward the
person. From a front-facing webcam the reliable 2D signal is the downward motion (the forward
component is along the camera axis and barely visible in 2D), so movement is a downward LINEAR
motion. Because the hand travels, location is checked as "did it REACH chin height" (its highest
point must be up at the chin) rather than an average position — a hand that starts below the chin
fails on location.

Parameters declared:
  - handshape (dominant): open / flat hand     [required]
  - movement: linear, downward                 [required]
  - location: reached chin height (Anchor.CHIN)[required]
  - orientation: palm up-ish                   [not required in v1]
"""
from core.schema import (
    DOMINANT,
    Anchor,
    HandShapeReq,
    LocationReq,
    MovementKind,
    MovementReq,
    OrientationReq,
    PalmFacing,
    Sign,
)

THANK_YOU = Sign(
    name="THANK_YOU",
    two_handed=False,
    dominant=HandShapeReq(kind="open", required=True),
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.CHIN,      # the hand must reach the chin (near the real mouth landmark)
        acting_hand=DOMINANT,
        max_dist_ratio=0.5,      # within ~0.5 shoulder-widths of the mouth at its closest approach
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, 1.0),            # downward in image space (y grows downward)
        min_displacement_ratio=0.2,      # ~0.2 shoulder-widths of travel (real strokes are ~0.36)
        min_duration_s=0.4,
        # min_confidence raised 0.25->0.85 (2026-07-19): the TS engine (web/src/engine/signs/
        # index.ts) was already raised to 0.85 on 2026-07-14 after a real calibration log showed a
        # chin-touch confusor (tapping/resting near the chin without a full downward push)
        # sustaining a false accept at 0.25 — this Python mirror was never updated to match,
        # violating the "never diverge" rule (CLAUDE.md). Reconciled here; no independent Python
        # calibration data justifies a different value.
        required=True, min_confidence=0.85),
    orientation=OrientationReq(hand=DOMINANT, facing=PalmFacing.UP, required=False, min_confidence=0.25),
)
