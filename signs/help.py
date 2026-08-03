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
    # 0.45 (not the 0.5 default): live-calibrated in the web engine against help_real.json — at 0.5
    # the platform hand's confidence dips below threshold mid-lift and flips the verifier's
    # hand-role assignment, failing the recording on handshape_dominant of all things.
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.45),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.80,             # 0.80 lets the lifted fist move higher before location fails (web calibration)
        min_dist_ratio=0.0,
        vertical=None,
        required=True,
        min_confidence=0.44,
    ),
    movement=MovementReq(
        kind=MovementKind.LINEAR,
        actor=DOMINANT,
        direction=(0.0, -1.0),           # image-space up (y decreases upward)
        min_displacement_ratio=0.12,     # a DELIBERATE lift, not a drift (0.12 per web calibration)
        min_duration_s=0.3,
        # Investigated 2026-07-14 against a real webcam rapid/random-movement confusor. At the
        # Python hospital_shop scenario's own short 1.5s window, min_confidence=0.98 looked like a
        # clean fix (correct streak 10, rapid streak 3) — but the web app's useRecognition.ts uses
        # a uniform 2.0s window for every sign, not 1.5s, and at 2.0s that same 0.98 breaks correct
        # HELP outright (its own lift signal dilutes over the longer window — the exact effect the
        # web engine's HELP definition already works around by dropping the direction requirement
        # entirely, see web/src/engine/signs/index.ts). No single min_confidence keeps correct's
        # live streak above the app's 6-frame debounce while dropping rapid's below it at 2.0s
        # (rapid's net displacement was frequently AS BIG as a real lift's — magnitude alone can't
        # separate them). Reverted to the original 0.25. Real rapid movement near the palm remains
        # an unresolved false positive here — same rule-based-v1 ceiling as HOSPITAL/DOCTOR/
        # MEDICINE/BREATHE/MORE. The web app's trained classifier gate (knownSigns includes HELP)
        # is the actual backstop until this check has more than position/displacement to work with.
        min_confidence=0.25,
        required=True,
    ),
    orientation=OrientationReq(hand=NONDOMINANT, facing=PalmFacing.UP, required=False, min_confidence=0.25),
)
