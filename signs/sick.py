"""SICK sign definition.

ASL SICK: both hands' middle fingers extend; the dominant middle finger touches the forehead and
the non-dominant middle finger touches the stomach, with a slight inward twist of both wrists.

v1 approximation (documented): a wrist TWIST barely moves the palm centre we track, so it can't be
reliably detected — SICK is therefore gated as a static two-location POSE, which is itself highly
distinctive (you don't accidentally make two middle-finger hands with one up at your forehead).
This is the no-movement branch of the schema (like the LETTER_A control): movement is `none` and
not required. The stomach position of the non-dominant hand is described but not separately gated
(LocationReq anchors a single hand); the forehead reach of the dominant hand is the spatial gate.

Parameters:
  handshape (dominant): "middle"             [required]
  handshape (non-dom):  "middle"             [required]
  location: dominant hand up at the forehead [required]
  movement: none (static pose; twist ungated)[not required]
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

SICK = Sign(
    name="SICK",
    two_handed=True,
    dominant=HandShapeReq(kind="middle", required=True, min_confidence=0.25),
    # The low (belly) hand often sits near the bottom of the frame and drops out of detection, so
    # it is required to be PRESENT but its handshape is not gated — the forehead hand carries it.
    nondominant=HandShapeReq(kind="middle", required=False, min_confidence=0.25),
    location=LocationReq(
        anchor=Anchor.FOREHEAD,      # dominant middle finger up at the forehead
        acting_hand=DOMINANT,
        max_dist_ratio=0.6,
        required=True, min_confidence=0.25),
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
