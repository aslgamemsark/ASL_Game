"""HOSPITAL sign definition.

ASL HOSPITAL: an "H" handshape (index + middle fingers together) draws a small cross/plus on the
upper arm of the opposite side — a short horizontal stroke, then a short downward stroke.

v1 approximation (documented): the "H" is recognised by finger count (same two-finger shape as
NURSE); location is "near a shoulder" (the opposite upper arm); the cross is approximated as a
short directed stroke (the `linear` detector with no fixed direction — any small drawn stroke
counts). HOSPITAL overlaps NURSE (both two-finger), separated here by LOCATION (shoulder/upper-arm
vs the wrist) and MOVEMENT KIND (a drawn stroke vs repeated taps). This overlap is a known
rule-based fragility, flagged for the future learned classifier.

Parameters:
  handshape (dominant): "h" (two fingers)        [required]
  handshape (non-dom):  the opposite arm         [present but NOT gated]
  location: near a shoulder (opposite upper arm) [required]
  movement: a short drawn stroke (the cross)     [required]
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

HOSPITAL = Sign(
    name="HOSPITAL",
    two_handed=True,
    dominant=HandShapeReq(kind="h", required=True, min_confidence=0.25),
    nondominant=HandShapeReq(kind="open", required=False, min_confidence=0.25),   # the opposite arm — present, not gated
    location=LocationReq(
        anchor=Anchor.SHOULDER,
        acting_hand=DOMINANT,
        max_dist_ratio=0.4,          # within ~0.4 shoulder-widths of a shoulder
        below="mouth",               # on the upper arm, not up at the face
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=None,              # the cross is two short strokes; any drawn travel counts
        # A real DRAWN cross, not just bringing the hand to the shoulder: demand a clear stroke so
        # "show 2 fingers near the shoulder" alone can't pass.
        min_displacement_ratio=0.25,
        min_duration_s=0.5,
        min_confidence=0.6,
        required=True,
    ),
)
