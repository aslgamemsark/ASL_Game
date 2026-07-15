"""DOCTOR sign definition.

ASL DOCTOR: the dominant hand (a flat "D" / bent-finger hand) taps the fingertips on the inside
of the opposite wrist (the pulse point), twice.

v1 approximation (documented, like HELP=fist): the precise "D" handshape isn't reliably
detectable, so the dominant hand is gated as a flat/open hand; the non-dominant hand stands in for
the wrist/forearm and is only required to be PRESENT (its handshape isn't gated). DOCTOR is a
minimal pair with NURSE — same location and motion, distinguished only by handshape (flat vs the
two-finger "N"). That's exactly where rule-based detection is fragile; flagged for the future
learned classifier.

Parameters:
  handshape (dominant): open / flat          [required]
  handshape (non-dom):  the wrist/arm        [present but NOT gated]
  location: near the non-dominant hand/wrist [required]
  movement: repeated taps toward the wrist   [required]
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

DOCTOR = Sign(
    name="DOCTOR",
    two_handed=True,
    dominant=HandShapeReq(kind="open", required=True, min_confidence=0.45),  # calibrated to the real flat-hand read
    nondominant=HandShapeReq(kind="open", required=False),   # the wrist/arm — present, not gated
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        use_closest_approach=True,  # a wrist-TAP: the hands touch (closest points), centres stay far
        max_dist_ratio=0.35,        # the tapping fingertips come within ~0.35 shoulder-widths
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        # Recalibrated 2026-07-14 against real webcam takes (correct DOCTOR vs. rapid/random hand
        # movement near the same spot): raw cycle counts over the live 1.5s window separated the
        # two — correct reached >=3 cycles 36% of the time (up to 4.5), rapid only 5% (up to 3.5).
        # min_cycles=2 let rapid movement sustain a false PASS streak well past the app's 6-frame
        # debounce; 3 removes that while correct still clears it comfortably.
        min_cycles=3,
        min_duration_s=0.5,
        required=True,
        # Real user report (2026-07-15): "doctor passes even on clapping." Tried gating on the
        # nondominant hand staying still (other_hand_max_motion_ratio, since clapping moves both
        # hands while a wrist-tap should only move the dominant one) — REVERTED after the real
        # doctor_correct.json fixture measured the "stationary" wrist hand's own path length at
        # 0.90 shoulder-widths over the 2s window, far above any reasonable stillness floor. A
        # held-out arm apparently drifts/resettles enough on its own that path length alone can't
        # tell it apart from an actively clapping hand. Needs a real recorded clap confusor to
        # find a working signal, not a guessed threshold — same rule-based-v1 ceiling as the
        # movement-cycle investigation below; the classifier gate is the actual backstop.
    ),
)
