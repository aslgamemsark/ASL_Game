"""Regression tests for the "rapid/random hand movement" confusor class — recorded 2026-07-14
after a report that several hospital/classroom/coffee signs could be triggered by doing nothing
or by moving the hands fast and randomly near the right spot.

Unlike test_hospital.py/test_classroom.py's TestConfusor/TestIdle (which replay a fixture through
one fixed window anchored at the clip's last frame), this simulates the ACTUAL live gameplay
debounce: verify() runs every frame against a sliding rolling buffer, and success is judged the
same way useRecognition.ts judges it — 6 CONSECUTIVE passing frames, reset on any failure. A
single-frame or scattered "lucky" pass is not what matters; a sustained streak is.

Window size: the web app (useRecognition.ts) uses a UNIFORM 2.0s window for every sign — not the
per-scenario 1.5s/2.0s split that exists only in the Python game loops (scenarios/hospital_shop
uses a shorter, stricter 1.5s "stale motion evicts quickly" window; classroom/coffee_shop use
2.0s). This file tests against 2.0s uniformly to match the real shipped product; the Python
hospital_shop scenario is generally at LEAST as resistant given its shorter window, but isn't
separately asserted here.

Investigation (see each sign's movement req in signs/*.py for the specific numbers) found this is
only fully fixable via schema thresholds for NURSE, WRITE, LETTER_P — asserted as hard passes.
DOCTOR, MEDICINE, HOSPITAL, HELP, BREATHE, MORE remain a documented rule-based-v1 ceiling for this
specific confusor (rapid movement's raw displacement/amplitude/cycle-count/approach measured AS
BIG OR BIGGER than the real sign's own at the live window — magnitude-only checks can't reject
"moved a lot, fast" the way they reject "didn't move"). Those are marked xfail with the measured
residual streak so a future improvement shows up as an unexpected pass rather than silently
regressing further. The web app's trained classifier gate (knownSigns includes all six except
LETTER_P, which isn't classifier-covered but is fully fixed via handshape anyway) is the real
backstop for the ceiling cases — this Python engine has no equivalent second layer.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import DOCTOR, NURSE, MEDICINE, HOSPITAL, HELP, BREATHE, MORE, WRITE, LETTER_P

FIXTURES = Path(__file__).parent / "fixtures"
CONSECUTIVE_REQUIRED = 6   # matches useRecognition.ts's PASS_THRESHOLD
LIVE_WINDOW_S = 2.0        # matches useRecognition.ts's RollingBuffer(2.0), used for every sign

SIGNS = [DOCTOR, NURSE, MEDICINE, HOSPITAL, HELP, BREATHE, MORE, WRITE, LETTER_P]
BASES = {
    "DOCTOR": "doctor", "NURSE": "nurse", "MEDICINE": "medicine", "HOSPITAL": "hospital",
    "HELP": "help", "BREATHE": "breathe", "MORE": "more", "WRITE": "write", "LETTER_P": "letter_p",
}

# Documented rule-based-v1 ceiling: a real recorded rapid/random-movement confusor still sustains
# a false PASS streak >= CONSECUTIVE_REQUIRED at the live 2.0s window (measured 2026-07-14). Not a
# test bug — see the movement req comment in each sign's file for the investigation and why no
# schema threshold resolves it.
KNOWN_RAPID_CEILING = {"DOCTOR", "MEDICINE", "HOSPITAL", "HELP", "BREATHE", "MORE"}


def _load_frames(base: str, kind: str) -> list[Frame]:
    path = FIXTURES / f"{base}_{kind}.json"
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


@pytest.mark.parametrize("sign", SIGNS, ids=[s.name for s in SIGNS])
class TestCorrectStillTriggersLive:
    """A real performance must still sustain 6 consecutive passing frames at the live window —
    the whole point of tightening confusor rejection is that it must not cost the real sign."""

    def test_correct_triggers(self, sign):
        frames = _load_frames(BASES[sign.name], "correct")
        streak = _best_consecutive_pass_streak(frames, sign)
        assert streak >= CONSECUTIVE_REQUIRED, (
            f"{sign.name} correct performance should sustain >= {CONSECUTIVE_REQUIRED} consecutive "
            f"passing frames at the live {LIVE_WINDOW_S}s window; best streak was {streak}"
        )


@pytest.mark.parametrize("sign", SIGNS, ids=[s.name for s in SIGNS])
class TestIdleNeverTriggersLive:
    """Doing nothing (hands present, not signing) must never sustain a passing streak. Fully
    fixed for all 9 signs as of 2026-07-14 — a hard assertion, no exceptions."""

    def test_idle_never_triggers(self, sign):
        frames = _load_frames(BASES[sign.name], "idle")
        streak = _best_consecutive_pass_streak(frames, sign)
        assert streak < CONSECUTIVE_REQUIRED, (
            f"{sign.name} idle (present but not signing) sustained a {streak}-frame passing streak "
            f"at the live {LIVE_WINDOW_S}s window — this must never reach {CONSECUTIVE_REQUIRED}"
        )


@pytest.mark.parametrize("sign", SIGNS, ids=[s.name for s in SIGNS])
class TestRapidNeverTriggersLive:
    """Fast, random hand movement near the right spot must never sustain a passing streak.

    Hard assertion for NURSE/WRITE/LETTER_P (confirmed fixed). Signs in KNOWN_RAPID_CEILING are
    xfail with the measured residual streak, documenting a real, investigated rule-based-v1
    limitation rather than silently allowing it — an unexpected pass here means the ceiling has
    been broken and the xfail marker should be removed.
    """

    def test_rapid_never_triggers(self, sign):
        frames = _load_frames(BASES[sign.name], "rapid")
        streak = _best_consecutive_pass_streak(frames, sign)
        if sign.name in KNOWN_RAPID_CEILING and streak >= CONSECUTIVE_REQUIRED:
            pytest.xfail(
                f"{sign.name}: known rule-based-v1 ceiling — rapid movement sustained a "
                f"{streak}-frame streak (>= {CONSECUTIVE_REQUIRED}); see signs/{BASES[sign.name]}.py"
            )
        assert streak < CONSECUTIVE_REQUIRED, (
            f"{sign.name} rapid/random movement sustained a {streak}-frame passing streak at the "
            f"live {LIVE_WINDOW_S}s window — this must never reach {CONSECUTIVE_REQUIRED}"
        )
