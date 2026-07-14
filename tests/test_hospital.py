"""Hospital scenario confusor regression tests.

Mirrors tests/test_coffee.py for every hospital movement sign. For each sign we replay two
committed fixtures through the SAME generic verifier:

  - <name>_correct.json  -> must PASS, with the movement parameter clearing its threshold.
  - <name>_confusor.json -> must FAIL, specifically because MOVEMENT is below threshold (the
    learner froze the correct pose). Handshape/location are NOT the reason it fails.

This is the real prevention mechanism for the single-frame bug: if anyone later weakens a
movement check or the schema guard, these tests fail loudly. Fixtures that have not been recorded
yet are skipped (so the suite stays green during incremental recording), but a sign whose
`correct` fixture exists MUST also ship a `confusor`, and vice-versa.

Record fixtures with:
    python -m tools.record_fixture --name help_correct  --seconds 3 --sign HELP
    python -m tools.record_fixture --name help_confusor --seconds 3 --sign HELP   # hold it FROZEN
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import (
    HELP, PAIN, MEDICINE, EMERGENCY,
    DOCTOR, NURSE, FEVER, WATER, BREATHE, HOSPITAL, DIZZY, SICK,
)

FIXTURES = Path(__file__).parent / "fixtures"

# Movement signs: each ships a <base>_correct, <base>_confusor (frozen) and <base>_idle (present
# but not signing) fixture. SICK is a static pose and is tested separately (TestSick).
HOSPITAL_SIGNS = [
    (HELP, "help"),
    (PAIN, "pain"),
    (MEDICINE, "medicine"),
    (EMERGENCY, "emergency"),
    (DOCTOR, "doctor"),
    (NURSE, "nurse"),
    (FEVER, "fever"),
    (BREATHE, "breathe"),
    (HOSPITAL, "hospital"),
    (DIZZY, "dizzy"),
]


def _fixture_path(base: str, kind: str) -> Path:
    return FIXTURES / f"{base}_{kind}.json"


def _load_buffer(base: str, kind: str) -> RollingBuffer:
    with open(_fixture_path(base, kind)) as fh:
        data = json.load(fh)
    buf = RollingBuffer(window_seconds=5.0)
    for fd in data["frames"]:
        buf.add(Frame.from_dict(fd))
    return buf


def _require(base: str, kind: str) -> RollingBuffer:
    path = _fixture_path(base, kind)
    if not path.exists():
        pytest.skip(f"fixture not recorded yet: {path.name}")
    return _load_buffer(base, kind)


# Live gameplay recognises a sign the moment a SLIDING rolling buffer (2.0s — matches
# useRecognition.ts's window) yields a pass on any frame, not from one fixed window anchored at a
# recorded clip's last frame. A real take often has a second or two of "settling" after the actual
# sign motion before the clip ends, which a last-frame-only check can misread as a failure even
# though the sign was clearly recognised mid-clip. Used for the "must pass" assertions below;
# TestConfusor/TestIdle keep the simpler whole-clip check since a fixture that never passes at all
# fails it identically either way.
def _require_frames(base: str, kind: str) -> list[Frame]:
    path = _fixture_path(base, kind)
    if not path.exists():
        pytest.skip(f"fixture not recorded yet: {path.name}")
    with open(path) as fh:
        data = json.load(fh)
    return [Frame.from_dict(fd) for fd in data["frames"]]


def _best_over_clip(frames: list[Frame], sign, window_s: float = 2.0):
    buf = RollingBuffer(window_seconds=window_s)
    best = None
    for f in frames:
        buf.add(f)
        result = verify(buf, sign)
        m = result.get("movement")
        if best is None or (m is not None and m.score > (best.get("movement").score if best.get("movement") else -1)):
            best = result
        if result.passed:
            return result
    return best


@pytest.mark.parametrize("sign,base", HOSPITAL_SIGNS, ids=[s.name for s, _ in HOSPITAL_SIGNS])
class TestCorrect:
    """The correctly-performed sign must pass, and its movement must clear threshold, at SOME
    point during the clip (sliding-window check — see _best_over_clip)."""

    def test_overall_pass(self, sign, base):
        result = _best_over_clip(_require_frames(base, "correct"), sign)
        assert result.passed, (
            f"{sign.name} correct should pass but failed on: {result.failing_required}"
        )

    def test_movement_clears_threshold(self, sign, base):
        result = _best_over_clip(_require_frames(base, "correct"), sign)
        m = result.get("movement")
        assert m is not None and m.score >= m.threshold, (
            f"{sign.name} correct movement should clear: {m.score:.2f} < {m.threshold:.2f}"
        )


@pytest.mark.parametrize("sign,base", HOSPITAL_SIGNS, ids=[s.name for s, _ in HOSPITAL_SIGNS])
class TestConfusor:
    """The frozen pose — correct handshape, no motion — must fail ON MOVEMENT specifically."""

    def test_overall_fail(self, sign, base):
        result = verify(_require(base, "confusor"), sign)
        assert not result.passed, f"{sign.name} frozen confusor must NOT pass"

    def test_fails_on_movement(self, sign, base):
        result = verify(_require(base, "confusor"), sign)
        assert "movement" in result.failing_required, (
            f"{sign.name} confusor should fail on movement, "
            f"but failing_required={result.failing_required}"
        )

    def test_movement_below_threshold(self, sign, base):
        result = verify(_require(base, "confusor"), sign)
        m = result.get("movement")
        assert m is not None and m.score < m.threshold, (
            f"{sign.name} confusor movement should be below threshold: "
            f"{m.score:.2f} >= {m.threshold:.2f}"
        )


@pytest.mark.parametrize("sign,base", HOSPITAL_SIGNS, ids=[s.name for s, _ in HOSPITAL_SIGNS])
class TestIdle:
    """The cardinal false-positive case: hands present in roughly the right handshape but the user
    is NOT performing the sign — only incidental jitter. Must never pass, and must fail on movement
    (it is the absence of the real motion that disqualifies it, not the handshape)."""

    def test_overall_fail(self, sign, base):
        result = verify(_require(base, "idle"), sign)
        assert not result.passed, (
            f"{sign.name} idle (present but not signing) must NOT pass — "
            f"scores={[(p.name, round(p.score, 2)) for p in result.params]}"
        )

    def test_fails_on_movement(self, sign, base):
        result = verify(_require(base, "idle"), sign)
        m = result.get("movement")
        assert m is not None and m.score < m.threshold, (
            f"{sign.name} idle movement should be below threshold: {m.score:.2f} >= {m.threshold:.2f}"
        )


class TestSick:
    """SICK is a STATIC two-location pose (the wrist twist isn't detectable from the palm centre),
    so it can't be gated on movement. Instead its negatives prove it can't pass without BOTH the
    right handshape AND the right location."""

    def test_correct_pass(self):
        assert verify(_require("sick", "correct"), SICK).passed, "correct SICK pose should pass"

    def test_wrong_handshape_fails(self):
        result = verify(_require("sick", "wrongshape"), SICK)
        assert not result.passed and "handshape_dominant" in result.failing_required, (
            f"open hands (not middle fingers) must fail SICK on handshape; failing={result.failing_required}"
        )

    def test_low_hand_fails_on_location(self):
        result = verify(_require("sick", "lowhand"), SICK)
        assert not result.passed and "location" in result.failing_required, (
            f"a hand not up at the forehead must fail SICK on location; failing={result.failing_required}"
        )


class TestWater:
    """WATER is a static "W reaching the chin" pose (the tap is undetectable from the palm centre),
    so its negatives test handshape and location rather than movement."""

    def test_correct_pass(self):
        assert verify(_require("water", "correct"), WATER).passed, "a W at the chin should pass WATER"

    def test_wrong_handshape_fails(self):
        result = verify(_require("water", "wrongshape"), WATER)
        assert not result.passed and "handshape_dominant" in result.failing_required, (
            f"an open hand at the chin must fail WATER on handshape; failing={result.failing_required}"
        )

    def test_off_chin_fails_on_location(self):
        result = verify(_require("water", "offchin"), WATER)
        assert not result.passed and "location" in result.failing_required, (
            f"a W down at the chest must fail WATER on location; failing={result.failing_required}"
        )


_ALL = {s.name: s for s, _ in HOSPITAL_SIGNS}
_ALL["SICK"] = SICK


@pytest.mark.parametrize("sign,base", HOSPITAL_SIGNS, ids=[s.name for s, _ in HOSPITAL_SIGNS])
def test_each_sign_passes_its_own_performance(sign, base):
    """The gameplay guarantee: a correctly-performed sign passes ITS OWN sign.

    (Exclusivity between signs is NOT asserted: real signers collapse several handshapes to an
    open hand, so e.g. DOCTOR/NURSE/BREATHE/MEDICINE overlap in rule-based v1. In play only the
    PROMPTED sign is ever verified, so overlaps don't affect a player doing the right sign. The
    false-positive guarantees that DO matter — a frozen/idle/wrong performance must fail — are
    locked by TestConfusor, TestIdle and tests/test_adversarial.py.)
    """
    assert _best_over_clip(_require_frames(base, "correct"), sign).passed, f"{sign.name} must pass its own performance"
