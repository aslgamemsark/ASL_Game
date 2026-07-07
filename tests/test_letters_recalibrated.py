"""Regression tests for LETTER_A/C/E/M/S/X, calibrated against real recordings (2026-07).

Handshapes A, C, M, and X previously used guessed thresholds that never matched a real hand
(measured confidence 0.00-0.15 against a genuine performance) — see core/handshape.py for the
recalibrated per-letter geometry. These fixtures are the actual recordings that exposed the bug;
keeping them as a regression test means a future threshold tweak can't silently reintroduce it.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.landmarks import Frame, RollingBuffer
from core.verifier import verify
from signs import LETTER_A, LETTER_C, LETTER_E, LETTER_M, LETTER_S, LETTER_X

FIXTURES = Path(__file__).parent / "fixtures"

SIGNS = {
    "letter_a": LETTER_A,
    "letter_c": LETTER_C,
    "letter_e": LETTER_E,
    "letter_m": LETTER_M,
    "letter_s": LETTER_S,
    "letter_x": LETTER_X,
}


def _load_buffer(name: str) -> RollingBuffer:
    with open(FIXTURES / f"{name}.json") as fh:
        data = json.load(fh)
    buf = RollingBuffer(window_seconds=5.0)
    for fd in data["frames"]:
        buf.add(Frame.from_dict(fd))
    return buf


@pytest.mark.parametrize("base,sign", SIGNS.items())
def test_real_recording_passes(base, sign):
    result = verify(_load_buffer(f"{base}_correct"), sign)
    assert result.passed, f"{sign.name} real recording should pass; failing={result.failing_required}"
