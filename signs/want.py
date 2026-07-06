"""WANT sign.

Both open ('claw') hands drawn toward the body — read here as a downward LINEAR pull. Two-handed;
the more-mobile hand is the actor. Handshape (both open) + a downward linear movement.
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

WANT = Sign(
    name="WANT",
    two_handed=True,
    dominant=HandShapeReq(kind="open", required=True),
    nondominant=HandShapeReq(kind="open", required=True),
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, 1.0),            # toward the body reads mostly as downward in 2D
        min_displacement_ratio=0.2,
        min_duration_s=0.4,
        required=True, min_confidence=0.25),
)
