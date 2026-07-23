"""One-off calibration report for the B vs 5 handshape confusor pair (real user report, 2026-07-23:
"B still passes on 5 fingers"). Loads two fixtures recorded via `tools/record_fixture.py`
(letter_b_correct.json, letter_b_confusor_5.json) and scores every single-hand frame through
b_confidence/five_confidence directly — bypassing the full LETTER_B sign verifier, since we only
care about the one parameter (handshape) these fixtures were recorded to isolate.

Run:
    python -m tools.recalibrate_b_five
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from core.handshape import (
    _adjacent_finger_spread,  # noqa: SLF001 — deliberate internal-metric access for calibration
    _hand_scale,  # noqa: SLF001
    _thumb_extended,  # noqa: SLF001
    _xy,  # noqa: SLF001
    b_confidence,
    five_confidence,
    open_confidence,
)
from core.landmarks import INDEX_MCP, INDEX_TIP, PINKY_TIP, THUMB_TIP, Frame, Hand


def raw_thumb_dist(hand: Hand) -> float:
    """_thumb_extended's distance BEFORE the (0.5, 1.2) clip — checking whether a real but smaller
    difference exists that the clip floor is hiding (that floor was already flagged as
    miscalibrated for A/L/Y in handshape.py's a_confidence comment)."""
    return float(np.linalg.norm(_xy(hand, THUMB_TIP) - _xy(hand, INDEX_MCP))) / _hand_scale(hand)


def index_pinky_span(hand: Hand) -> float:
    """Alternative candidate metric: direct index-to-pinky tip distance (the outermost pair),
    instead of averaging the three adjacent-pair gaps. Exploring whether this discriminates B vs 5
    better on real data before recalibrating thresholds against it."""
    return float(np.linalg.norm(_xy(hand, INDEX_TIP) - _xy(hand, PINKY_TIP))) / _hand_scale(hand)


# Candidate replacement mechanism: B/5 are textbook distinguished by THUMB position (tucked across
# the palm vs extended out as the 5th spread digit), not adjacent-finger spacing — the spread
# metric barely separated real B from real 5 above, exactly matching ASL's own definition of the
# pair. Tight band centered on the real midpoint between this user's B/5 raw_thumb_dist medians
# (0.252 / 0.287 -> ~0.27), not the wide (0.5, 1.2) band built for L/Y's much-farther-out thumb.
_THUMB_TUCKED_LOW = 0.25   # full "tucked" credit at/below this raw distance
_THUMB_TUCKED_HIGH = 0.29  # zero "tucked" credit at/above this


def candidate_b_confidence(hand: Hand) -> float:
    tucked = np.clip((_THUMB_TUCKED_HIGH - raw_thumb_dist(hand)) / (_THUMB_TUCKED_HIGH - _THUMB_TUCKED_LOW), 0.0, 1.0)
    return float(min(open_confidence(hand), tucked))


def candidate_five_confidence(hand: Hand) -> float:
    extended = np.clip((raw_thumb_dist(hand) - _THUMB_TUCKED_LOW) / (_THUMB_TUCKED_HIGH - _THUMB_TUCKED_LOW), 0.0, 1.0)
    return float(min(open_confidence(hand), extended))

FIXTURES_DIR = Path("tests/fixtures")


def load_frames(name: str) -> list[Frame]:
    data = json.loads((FIXTURES_DIR / f"{name}.json").read_text(encoding="utf-8"))
    return [Frame.from_dict(d) for d in data["frames"]]


def stats(vals: list[float]) -> str:
    if not vals:
        return "n=0 --/--/--"
    s = sorted(vals)
    return f"n={len(vals)} med={s[len(s) // 2]:.3f} min={s[0]:.3f} max={s[-1]:.3f}"


def report(label: str, frames: list[Frame]) -> None:
    single_hand = [f.hands[0] for f in frames if len(f.hands) == 1]
    print(f"\n{label}: {len(frames)} frames, {len(single_hand)} with exactly one hand")
    if not single_hand:
        print("  no usable frames — nothing scored")
        return
    open_vals = [open_confidence(h) for h in single_hand]
    b_vals = [b_confidence(h) for h in single_hand]
    five_vals = [five_confidence(h) for h in single_hand]
    spread_vals = [_adjacent_finger_spread(h) for h in single_hand]
    span_vals = [index_pinky_span(h) for h in single_hand]
    thumb_vals = [_thumb_extended(h) for h in single_hand]
    raw_thumb_vals = [raw_thumb_dist(h) for h in single_hand]
    print(f"  open_confidence:        {stats(open_vals)}")
    print(f"  adjacent_finger_spread: {stats(spread_vals)}  (raw hand-scale-normalized units)")
    print(f"  index_pinky_span:       {stats(span_vals)}  (raw hand-scale-normalized units)")
    print(f"  thumb_extended:         {stats(thumb_vals)}  (0=tucked, 1=out; clipped 0.5-1.2)")
    print(f"  raw_thumb_dist:         {stats(raw_thumb_vals)}  (UNCLIPPED hand-scale units)")
    print(f"  b_confidence (current): {stats(b_vals)}   [threshold 0.6]")
    print(f"  five_confidence (cur.): {stats(five_vals)}   [threshold 0.6]")
    cand_b = [candidate_b_confidence(h) for h in single_hand]
    cand_five = [candidate_five_confidence(h) for h in single_hand]
    print(f"  b_confidence (CANDIDATE):    {stats(cand_b)}   [threshold 0.6]")
    print(f"  five_confidence (CANDIDATE): {stats(cand_five)}   [threshold 0.6]")


def main() -> None:
    correct = load_frames("letter_b_correct")
    confusor = load_frames("letter_b_confusor_5")
    report("CORRECT (performed B)", correct)
    report("CONFUSOR (performed 5)", confusor)


if __name__ == "__main__":
    main()
