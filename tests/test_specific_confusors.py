"""Regression tests for specific confusors found via live user testing on 2026-07-14, distinct
from the generic idle/rapid-movement class in tests/test_rapid_confusor.py:

  NURSE middle_only — a plain middle-finger tap (index NOT intentionally extended) used to pass
    NURSE's "N" handshape check. Root cause: the old MIN-over-fingers pattern match can't tell
    "both fingers genuinely extended together" from "one finger intentionally extended, the other
    incidentally reads partially extended" — real fingers aren't independent. Fixed via a parity
    term (core.handshape._two_finger_confidence) requiring index and middle to be SIMILARLY
    extended, not just each individually clearing a floor. Shared by "h" (HOSPITAL), so both
    signs get the fix.
  NURSE/DOCTOR clap — clapping (open hands, closing together, repeatedly) satisfies every
    parameter DOCTOR checks (open handshape, hands getting very close, repeated motion) since the
    location check only verifies SOME point on one hand gets close to SOME point on the other, not
    specifically the wrist. NURSE already rejects this via its "N" handshape (open hands fail the
    2-finger pattern); DOCTOR does not, since its dominant handshape is just "open" — same as a
    clapping hand. Investigated (wrist-specific distance, hand-motion-symmetry) but found no safe
    fix given the low, noisy sample count MediaPipe captures during actual hand-to-hand contact —
    left open as a documented gap (xfail).
  MEDICINE wrong_hand — holding the acting hand still and instead wiggling the OTHER hand near it
    still passes. Root cause: MEDICINE's dominant and nondominant handshapes are both "open" (the
    real ASL distinction, dominant claw vs nondominant flat palm, was previously found unreliable
    to detect and dropped — see signs/medicine.py), so role assignment falls back entirely to
    "whichever hand moved more = dominant." A handedness-agnostic verifier structurally cannot
    reject "the other hand did the qualifying motion instead" when both hands look identical —
    left open as a documented gap (xfail).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import NURSE, HOSPITAL, DOCTOR, MEDICINE

FIXTURES = Path(__file__).parent / "fixtures"
CONSECUTIVE_REQUIRED = 6
LIVE_WINDOW_S = 2.0


def _load_frames(name: str) -> list[Frame]:
    path = FIXTURES / f"{name}.json"
    if not path.exists():
        pytest.skip(f"fixture not recorded yet: {path.name}")
    data = json.load(open(path))
    return [Frame.from_dict(fd) for fd in data["frames"]]


def _best_consecutive_pass_streak(frames: list[Frame], sign) -> int:
    buf = RollingBuffer(window_seconds=LIVE_WINDOW_S)
    streak = best = 0
    for f in frames:
        buf.add(f)
        if verify(buf, sign).passed:
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return best


class TestNurseTwoFingerParity:
    """Fixed: a plain middle-finger tap and clapping must not pass NURSE's handshape check."""

    def test_correct_still_triggers(self):
        streak = _best_consecutive_pass_streak(_load_frames("nurse_correct"), NURSE)
        assert streak >= CONSECUTIVE_REQUIRED, f"NURSE correct should still pass; streak={streak}"

    def test_middle_finger_only_rejected(self):
        streak = _best_consecutive_pass_streak(_load_frames("nurse_middle_only"), NURSE)
        assert streak < CONSECUTIVE_REQUIRED, f"NURSE must reject a plain middle-finger tap; streak={streak}"

    def test_clap_rejected(self):
        streak = _best_consecutive_pass_streak(_load_frames("nurse_clap"), NURSE)
        assert streak < CONSECUTIVE_REQUIRED, f"NURSE must reject clapping; streak={streak}"


class TestHospitalTwoFingerParity:
    """HOSPITAL shares NURSE's 2-finger handshape check — same fix, same guarantee."""

    def test_correct_still_triggers(self):
        streak = _best_consecutive_pass_streak(_load_frames("hospital_correct"), HOSPITAL)
        assert streak >= CONSECUTIVE_REQUIRED, f"HOSPITAL correct should still pass; streak={streak}"


class TestDoctorClap:
    """Documented open gap: clapping still passes DOCTOR (open handshape, no wrist-specific
    location check). xfail until a real fix is found — an unexpected pass here means it's fixed."""

    def test_clap_rejected(self):
        streak = _best_consecutive_pass_streak(_load_frames("doctor_clap"), DOCTOR)
        if streak >= CONSECUTIVE_REQUIRED:
            pytest.xfail(f"known open gap — clap sustained a {streak}-frame streak; see signs/doctor.py")
        assert streak < CONSECUTIVE_REQUIRED


class TestMedicineWrongHand:
    """Documented open gap: wiggling the non-acting hand still passes MEDICINE, since both hands
    share the same handshape and role assignment is purely motion-based. xfail until a real fix
    is found (would need a genuine dominant/nondominant handshape distinction)."""

    def test_wrong_hand_rejected(self):
        streak = _best_consecutive_pass_streak(_load_frames("medicine_wrong_hand"), MEDICINE)
        if streak >= CONSECUTIVE_REQUIRED:
            pytest.xfail(f"known open gap — wrong-hand motion sustained a {streak}-frame streak; see signs/medicine.py")
        assert streak < CONSECUTIVE_REQUIRED
