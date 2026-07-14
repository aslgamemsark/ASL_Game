"""BREATHE sign definition.

ASL BREATHE: both open hands rest on the chest, fingers spread; they move outward (inhale) then
back in (exhale), repeating fluidly.

v1: both hands open, on the chest, with a repeated in/out motion. Each hand oscillates away from
and back toward the centre, so the dominant hand's path is a clean repeated oscillation — gated by
the same `repeated` detector as MEDICINE/EMERGENCY. Distinct from Saad's PLEASE (one hand,
circular, on the chest) by hand count and movement kind.

Parameters:
  handshape (dominant + non-dom): open / spread [required]
  location: on the chest                         [required]
  movement: repeated out/in (the breath)         [required]
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

BREATHE = Sign(
    name="BREATHE",
    two_handed=True,
    dominant=HandShapeReq(kind="open", required=True, min_confidence=0.55),
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.55),
    location=LocationReq(
        anchor=Anchor.CHEST,
        acting_hand=DOMINANT,
        max_dist_ratio=0.6,          # hands start spread on the chest and move outward
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        min_cycles=1,               # calibrated: one slow out/in fits a live ~1.5s window
        # Investigated 2026-07-14 against a real webcam rapid/random-movement confusor: raising
        # min_cycles to 2 (correct reached >=3 cycles only 23% of the time vs. rapid's 5%, which
        # looked promising in isolation) broke correct BREATHE outright at the app's live 1.5s
        # window + 6-frame debounce — the cycle and amplitude gates compounding pushed its
        # consecutive-pass streak below 6, while rapid (44-frame streak) was barely dented. Reverted
        # to 1. Rapid movement near the chest remains a real, unresolved false positive here — same
        # rule-based-v1 ceiling as HOSPITAL/MORE (see their movement req comments): a fast, chaotic
        # in/out motion satisfies "repeated oscillation with amplitude" just as well as a real
        # breath. The web app's trained classifier gate (knownSigns includes BREATHE) is the actual
        # backstop until this check has more than position/cycle-count to work with.
        min_amplitude_ratio=0.12,   # a DELIBERATE breath — a big out/in, not passive resting motion
        min_duration_s=0.6,
        required=True,
    ),
)
