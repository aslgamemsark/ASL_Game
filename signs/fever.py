"""FEVER sign definition.

ASL FEVER: the back of the dominant (flat) hand brushes across the forehead in a single smooth
sweep — like checking your own temperature.

v1: gated as an open/flat hand UP at the forehead with a horizontal-ish linear sweep. We don't
require a specific left/right direction (people sweep either way), only that the hand travels
while up at the face — distinguishing it from the static SICK and the circular DIZZY.

Parameters:
  handshape (dominant): open / flat          [required]
  location: up at the forehead               [required]
  movement: a linear sweep across the brow   [required]
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

FEVER = Sign(
    name="FEVER",
    two_handed=False,
    dominant=HandShapeReq(kind="open", required=True, min_confidence=0.55),
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.FOREHEAD,
        acting_hand=DOMINANT,
        max_dist_ratio=0.7,          # the sweep travels sideways across the brow
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=None,              # either-way horizontal sweep; magnitude + forehead carry it
        min_displacement_ratio=0.18,
        min_duration_s=0.4,
        min_confidence=0.5,
        required=True,
        # Real user report (2026-07-15): "fever passes just when i bring my hand closer to my
        # forehead" — the REACH toward the forehead is itself linear displacement, satisfying a
        # magnitude-only check before any actual sweep happens. gate_to_location restricts
        # displacement to frames already at the forehead, so only the post-arrival sweep counts.
        gate_to_location=True,
    ),
)
