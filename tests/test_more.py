"""MORE confusor regression test.

MORE = two claw hands converging until fingertips meet. The confusor holds the same claw
handshape apart with no motion — correct handshape, plausible location, but no convergence. It
must FAIL specifically on movement, the same anti-bug guarantee as PAIN and COFFEE.
"""
from __future__ import annotations

import json
from pathlib import Path

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import MORE

FIXTURES = Path(__file__).parent / "fixtures"


def _load_buffer(name: str) -> RollingBuffer:
    with open(FIXTURES / f"{name}.json") as fh:
        data = json.load(fh)
    buf = RollingBuffer(window_seconds=5.0)
    for fd in data["frames"]:
        buf.add(Frame.from_dict(fd))
    return buf


class TestMoreCorrect:
    def test_overall_pass(self):
        result = verify(_load_buffer("more_correct"), MORE)
        assert result.passed, f"Correct MORE should pass; failing={result.failing_required}"

    def test_movement_clears(self):
        m = verify(_load_buffer("more_correct"), MORE).get("movement")
        assert m.score >= m.threshold, f"movement {m.score:.2f} < {m.threshold:.2f}"

    def test_handshape_claw(self):
        result = verify(_load_buffer("more_correct"), MORE)
        for name in ("handshape_dominant", "handshape_nondominant"):
            p = result.get(name)
            assert p is not None and p.cleared, f"{name} should clear: {p.score:.2f}"


class TestMoreConfusor:
    """Two claw hands held apart, motionless — the exact 'looks right, isn't moving' trap."""

    def test_overall_fail(self):
        assert not verify(_load_buffer("more_confusor"), MORE).passed

    def test_fails_on_movement(self):
        result = verify(_load_buffer("more_confusor"), MORE)
        assert "movement" in result.failing_required, (
            f"confusor should fail on movement; failing={result.failing_required}"
        )

    def test_handshape_still_good(self):
        """The confusor has correct claw hands — it fails ONLY because of movement."""
        result = verify(_load_buffer("more_confusor"), MORE)
        for name in ("handshape_dominant", "handshape_nondominant"):
            p = result.get(name)
            assert p is not None and p.cleared, f"confusor {name} should still be good: {p.score:.2f}"
