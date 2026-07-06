"""WATER sign definition.

ASL WATER: the "W" handshape (index + middle + ring extended) taps the fingertips to the chin
twice.

v1: "W" is recognised by finger count (three extended fingers); location reuses Saad's CHIN reach
(measured against the real mouth landmark); the two taps are a repeated motion. The W handshape +
chin makes this cleanly distinct from the other signs.

Parameters:
  handshape (dominant): "w" (three fingers)  [required]
  location: reaches chin height (Anchor.CHIN)[required]
  movement: repeated taps at the chin        [required]
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

WATER = Sign(
    name="WATER",
    two_handed=False,
    dominant=HandShapeReq(kind="w", required=True, min_confidence=0.25),
    nondominant=None,
    location=LocationReq(
        anchor=Anchor.CHIN,
        acting_hand=DOMINANT,
        max_dist_ratio=0.5,
        required=True,
    ),
    # The chin-TAP barely moves the palm centre (it's a fingertip motion), so it is indistinguishable
    # from jitter and can't be gated without false positives. WATER is therefore recognised as the
    # distinctive "W reaching the chin" pose (a static sign, like the fingerspelled letters); the
    # 3-finger W + the chin location are unambiguous on their own.
    movement=MovementReq(kind=MovementKind.NONE, required=False),
)
