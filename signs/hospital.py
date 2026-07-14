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
        # Investigated 2026-07-14 against a real webcam rapid/random-movement confusor: direction is
        # None here (the cross has no fixed direction), so linear_confidence is magnitude-only —
        # and rapid random hand movement's net displacement near the shoulder measured LARGER than
        # the real cross-stroke's (rapid median 0.266 shoulder-widths vs. correct's 0.129). No
        # min_confidence in [0,1] separates them: every value that keeps correct's live-window PASS
        # streak above the app's 6-frame debounce still leaves rapid's streak above it too (rapid
        # sustains a false PASS from 0.5 up through 1.0). A magnitude-only check structurally cannot
        # reject "moved a lot, fast" for a sign with no fixed direction. The web app's trained
        # classifier gate (knownSigns includes HOSPITAL) is the real backstop for this confusor
        # class until this check has more than position/displacement to work with.
        min_confidence=0.6,
        required=True,
    ),
)
