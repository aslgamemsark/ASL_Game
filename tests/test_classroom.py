"""Classroom scenario confusor regression tests: TEACHER, WRITE, READ, NAME, FRIEND.

Each correct fixture performs the real motion and clears every required parameter. Each confusor
freezes the SAME handshape/position with NO motion, so it must fail specifically on the movement
parameter — the same anti-bug guarantee as every other movement sign in this codebase.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import TEACHER, WRITE, READ, NAME, FRIEND

FIXTURES = Path(__file__).parent / "fixtures"

SIGNS = {
    "teacher": TEACHER,
    "write": WRITE,
    "read": READ,
    "name": NAME,
    "friend": FRIEND,
}


def _load_buffer(name: str) -> RollingBuffer:
    with open(FIXTURES / f"{name}.json") as fh:
        data = json.load(fh)
    buf = RollingBuffer(window_seconds=5.0)
    for fd in data["frames"]:
        buf.add(Frame.from_dict(fd))
    return buf


@pytest.mark.parametrize("base,sign", SIGNS.items())
class TestClassroomCorrect:
    def test_overall_pass(self, base, sign):
        result = verify(_load_buffer(f"{base}_correct"), sign)
        assert result.passed, f"{sign.name} correct fixture should pass; failing={result.failing_required}"

    def test_movement_clears(self, base, sign):
        m = verify(_load_buffer(f"{base}_correct"), sign).get("movement")
        assert m.score >= m.threshold, f"{sign.name} movement {m.score:.2f} < {m.threshold:.2f}"

    def test_handshapes_clear(self, base, sign):
        result = verify(_load_buffer(f"{base}_correct"), sign)
        for name in ("handshape_dominant", "handshape_nondominant"):
            p = result.get(name)
            assert p is not None and p.cleared, f"{sign.name} {name} should clear: {p.score:.2f}"


@pytest.mark.parametrize("base,sign", SIGNS.items())
class TestClassroomConfusor:
    """Same handshape/position, held motionless — the exact 'looks right, isn't moving' trap."""

    def test_overall_fail(self, base, sign):
        assert not verify(_load_buffer(f"{base}_confusor"), sign).passed

    def test_fails_on_movement(self, base, sign):
        result = verify(_load_buffer(f"{base}_confusor"), sign)
        assert "movement" in result.failing_required, (
            f"{sign.name} confusor should fail on movement; failing={result.failing_required}"
        )

    def test_handshapes_still_good(self, base, sign):
        result = verify(_load_buffer(f"{base}_confusor"), sign)
        for name in ("handshape_dominant", "handshape_nondominant"):
            p = result.get(name)
            assert p is not None and p.cleared, f"{sign.name} confusor {name} should still be good: {p.score:.2f}"
