"""Calibration edge-case tests for the classroom signs + new fingerspelling letters.

`tests/test_classroom.py` proves each sign clears its own correct fixture and rejects a frozen
(zero-movement) confusor. This file goes further, per the standing rule in CLAUDE.md: a sign
verifier must never pass on partial evidence. Every case below is something that LOOKS plausibly
like the sign but is missing exactly one required parameter, and must fail specifically on that
parameter (not just "fail somehow") — an overall-fail that's actually failing for the wrong reason
would silently mask a real gap the next time someone tweaks a threshold.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import TEACHER, WRITE, READ, NAME, FRIEND, MORE, LETTER_I, LETTER_W

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> RollingBuffer:
    with open(FIXTURES / f"{name}.json") as fh:
        data = json.load(fh)
    buf = RollingBuffer(window_seconds=5.0)
    for fd in data["frames"]:
        buf.add(Frame.from_dict(fd))
    return buf


def _result(name: str, sign):
    return verify(_load(name), sign)


# --------------------------------------------------------------------------------- idle (present,
# not signing): correct-ish handshapes held with small jitter, no real progress on the gated param.
IDLE_CASES = [
    ("teacher_idle", TEACHER, "movement"),
    ("write_idle", WRITE, "movement"),
    ("read_idle", READ, "movement"),
    ("name_idle", NAME, "movement"),
    ("friend_idle", FRIEND, "movement"),
    ("more_idle", MORE, "movement"),
]


@pytest.mark.parametrize("fixture,sign,expected_failing_param", IDLE_CASES)
def test_idle_fails(fixture, sign, expected_failing_param):
    result = _result(fixture, sign)
    assert not result.passed, f"{sign.name} idle/jitter fixture should NOT pass"
    assert expected_failing_param in result.failing_required, (
        f"{sign.name} idle should fail on {expected_failing_param}; failing={result.failing_required}"
    )


# --------------------------------------------------------------------------------- wrong handshape:
# the sign's real movement/location, performed with a different (wrong) handshape.
WRONG_SHAPE_CASES = [
    ("teacher_wrong_shape", TEACHER),
    ("write_wrong_shape", WRITE),
    ("read_wrong_shape", READ),
    ("name_wrong_shape", NAME),
    ("friend_wrong_shape", FRIEND),
    ("more_wrong_shape", MORE),
]


@pytest.mark.parametrize("fixture,sign", WRONG_SHAPE_CASES)
def test_wrong_handshape_fails(fixture, sign):
    result = _result(fixture, sign)
    assert not result.passed, (
        f"{sign.name} performed with the wrong handshape should NOT pass just because the "
        f"movement/location is right"
    )
    failing = result.failing_required
    assert "handshape_dominant" in failing, (
        f"{sign.name} wrong-shape fixture should fail on handshape_dominant; failing={failing}"
    )


# --------------------------------------------------------------------------------- one hand missing:
# a two-handed sign performed with only the dominant hand ever appearing in frame.
ONE_HAND_CASES = [
    ("teacher_one_hand", TEACHER),
    ("write_one_hand", WRITE),
    ("read_one_hand", READ),
    ("name_one_hand", NAME),
    ("friend_one_hand", FRIEND),
    ("more_one_hand", MORE),
]


@pytest.mark.parametrize("fixture,sign", ONE_HAND_CASES)
def test_missing_nondominant_hand_fails(fixture, sign):
    assert sign.two_handed and sign.nondominant is not None and sign.nondominant.required, (
        f"{sign.name} test setup assumption broken: expected a required two-handed sign"
    )
    result = _result(fixture, sign)
    assert not result.passed, (
        f"{sign.name} with only one hand ever visible should NOT pass a two-handed sign"
    )
    assert "handshape_nondominant" in result.failing_required, (
        f"{sign.name} one-hand fixture should fail on handshape_nondominant; "
        f"failing={result.failing_required}"
    )


# --------------------------------------------------------------------------------- sign-specific cases


def test_teacher_wrong_location_fails():
    """Real open-hand outward movement, but performed at the chest instead of the forehead."""
    result = _result("teacher_wrong_location", TEACHER)
    assert not result.passed
    assert "location" in result.failing_required, result.failing_required


def test_read_wrong_direction_fails():
    """READ's V-hand sweep must go DOWN; the same sweep going UP must not satisfy 'linear movement'."""
    result = _result("read_wrong_direction", READ)
    assert not result.passed
    assert "movement" in result.failing_required, (
        f"READ swept upward should fail on movement (direction), got failing={result.failing_required}"
    )


@pytest.mark.parametrize("fixture,sign", [("name_too_far", NAME), ("friend_too_far", FRIEND)])
def test_hands_never_close_fails(fixture, sign):
    """Correct handshapes and real oscillation, but the hands never come close enough to tap."""
    result = _result(fixture, sign)
    assert not result.passed
    assert "location" in result.failing_required, (
        f"{sign.name} hands-too-far fixture should fail on location; failing={result.failing_required}"
    )


# --------------------------------------------------------------------------------- LETTER_I / LETTER_W
# Static (movement=NONE) letters: the entire risk surface is handshape confusion with a
# neighboring letter, called out explicitly in each sign's own docstring.

def test_letter_i_correct_passes():
    result = _result("letter_i_correct", LETTER_I)
    assert result.passed, f"LETTER_I correct fixture should pass; failing={result.failing_required}"


def test_letter_i_rejects_y_hand():
    """The exact documented risk: a real Y-hand (thumb OUT + pinky) must not read as I."""
    result = _result("letter_i_confusor_y", LETTER_I)
    assert not result.passed, "A real Y-hand (thumb extended) must NOT pass as LETTER_I"
    assert "handshape_dominant" in result.failing_required, result.failing_required


def test_letter_i_rejects_fist():
    result = _result("letter_i_confusor_fist", LETTER_I)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required, result.failing_required


def test_letter_i_rejects_point():
    result = _result("letter_i_confusor_point", LETTER_I)
    assert not result.passed
    assert "handshape_dominant" in result.failing_required, result.failing_required


def test_letter_w_correct_passes():
    result = _result("letter_w_correct", LETTER_W)
    assert result.passed, f"LETTER_W correct fixture should pass; failing={result.failing_required}"


@pytest.mark.parametrize("fixture", ["letter_w_confusor_v", "letter_w_confusor_open", "letter_w_confusor_fist"])
def test_letter_w_rejects_neighboring_shapes(fixture):
    result = _result(fixture, LETTER_W)
    assert not result.passed, f"{fixture} must NOT pass as LETTER_W"
    assert "handshape_dominant" in result.failing_required, result.failing_required
