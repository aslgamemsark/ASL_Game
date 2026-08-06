"""Regression test for the LETTER_B / 5 handshape confusor (real user report, 2026-07-23:
"B still passes on 5 fingers"). core/handshape.py's b_confidence/five_confidence were recalibrated
from THUMB position (not finger spread — see that module's THUMB_TUCKED_LOW/HIGH comment for why)
against these two real recordings. Keeping them as a regression test means a future threshold
tweak can't silently reintroduce the false-pass.
"""
from __future__ import annotations

import json
from pathlib import Path

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import LETTER_B

FIXTURES = Path(__file__).parent / "fixtures"


def _load_buffer(name: str) -> RollingBuffer:
    with open(FIXTURES / f"{name}.json") as fh:
        data = json.load(fh)
    buf = RollingBuffer(window_seconds=5.0)
    for fd in data["frames"]:
        buf.add(Frame.from_dict(fd))
    return buf


def test_real_b_recording_passes():
    result = verify(_load_buffer("letter_b_correct"), LETTER_B)
    assert result.passed, f"LETTER_B real recording should pass; failing={result.failing_required}"


def test_real_5_confusor_rejected():
    result = verify(_load_buffer("letter_b_confusor_5"), LETTER_B)
    assert not result.passed, "A real 5 (fingers spread, thumb out) must not pass as LETTER_B"
    assert "handshape_dominant" in result.failing_required
