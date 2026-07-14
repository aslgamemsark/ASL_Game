"""MEDICINE — repeated twisting movement over the non-dominant palm.

ASL MEDICINE: the non-dominant hand is an open, upward palm; the dominant hand (middle finger
toward the palm, approximated as a "claw" in v1) touches the palm center and rocks/twists back
and forth repeatedly. A single touch is not MEDICINE — the repetition is what identifies it.

Movement kind is REPEATED, so a static "claw over palm" pose fails on movement. The minimum
cycle count requires at least two full oscillations in the rolling window.

Parameters declared:
  handshape_dominant   : claw (middle-finger-toward-palm, approximated) [required]
  handshape_nondominant: open flat palm                                  [required]
  location             : dominant near the nondominant palm              [required]
  movement             : REPEATED twist/rock about the palm              [required]
  orientation          : nondominant palm up                             [not gated in v1]
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

MEDICINE = Sign(
    name="MEDICINE",
    two_handed=True,
    dominant=HandShapeReq(kind="open", required=True, min_confidence=0.55),  # calibrated: signer uses an open hand, not a claw
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.55),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.50,       # generous — hands overlap/occlude during the twist
        min_dist_ratio=0.0,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        # Recalibrated 2026-07-14 against real webcam takes: correct MEDICINE reached >=3 cycles
        # 55% of the time over the live 1.5s window (up to 4.5); rapid/random hand movement near
        # the same spot only 2% (up to 3.0). min_cycles=2 let rapid sustain a false PASS streak
        # past the app's 6-frame debounce; 3 removes that while correct still clears it easily.
        min_cycles=3,
        min_duration_s=0.6,
        required=True,
    ),
    orientation=OrientationReq(hand=NONDOMINANT, facing=PalmFacing.UP, required=False, min_confidence=0.25),
)
