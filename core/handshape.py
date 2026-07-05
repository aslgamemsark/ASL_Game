"""Geometric handshape predicates over a single hand's 21 landmarks.

Pure 2D geometry, orientation-tolerant where possible. Each predicate returns a confidence in
[0, 1]. The verifier smooths these across recent frames (median) so one noisy frame can't flip a
result.

Shapes supported:
  fist / s    — four fingers curled, thumb unconstrained (S-hand / plain fist)
  a           — four fingers curled AND thumb extended alongside (letter A)
  index / 1   — index extended, other three curled (pointing / "1" hand)
  open / b / 5 — all four fingers extended (flat palm / B-hand)
  claw        — fingers clearly curled but not fully closed (E-hand / bent-5)
  point       — index extended, others curled (exact per-finger pattern; alias of index)
  v           — index + middle extended, ring + pinky curled (V / peace)
  l           — thumb + index extended, others curled (L)
  y           — thumb + pinky extended, others curled (Y)

fist/a/index/open/claw use averaged curl scoring (hospital scenario calibration); v/l/y/point use
an exact per-finger pattern match. Both are smoothed by the verifier across frames.
"""
from __future__ import annotations

import numpy as np

from core.landmarks import (
    Hand,
    WRIST,
    THUMB_TIP,
    INDEX_MCP,
    INDEX_TIP,
    MIDDLE_MCP,
    MIDDLE_TIP,
    RING_MCP,
    RING_TIP,
    PINKY_MCP,
    PINKY_TIP,
)

# (tip, mcp) per non-thumb finger
_FINGER_LM = {
    "index": (INDEX_TIP, INDEX_MCP),
    "middle": (MIDDLE_TIP, MIDDLE_MCP),
    "ring": (RING_TIP, RING_MCP),
    "pinky": (PINKY_TIP, PINKY_MCP),
}
_FINGERS = tuple(_FINGER_LM.values())


def _xy(hand: Hand, idx: int) -> np.ndarray:
    return hand.points[idx, :2]


def _hand_scale(hand: Hand) -> float:
    s = float(np.linalg.norm(_xy(hand, MIDDLE_MCP) - _xy(hand, WRIST)))
    return s if s > 1e-6 else 1.0


def _finger_curl(hand: Hand, tip: int, mcp: int) -> float:
    """1.0 = curled (tip folded toward palm), 0.0 = extended.

    Uses the ratio of (tip->wrist) to (mcp->wrist): an extended finger puts its tip far past the
    knuckle (ratio ~1.6+); a curled finger folds the tip back (ratio drops to ~1.0 or below).
    """
    tip_d = float(np.linalg.norm(_xy(hand, tip) - _xy(hand, WRIST)))
    mcp_d = float(np.linalg.norm(_xy(hand, mcp) - _xy(hand, WRIST)))
    r = tip_d / max(mcp_d, 1e-6)
    return float(np.clip((1.6 - r) / (1.6 - 1.0), 0.0, 1.0))


def _all_curls(hand: Hand) -> list[float]:
    return [_finger_curl(hand, t, m) for t, m in _FINGERS]


def _thumb_extended(hand: Hand) -> float:
    """1.0 = thumb sticking out alongside the hand, 0.0 = tucked/across the palm."""
    d = float(np.linalg.norm(_xy(hand, THUMB_TIP) - _xy(hand, INDEX_MCP))) / _hand_scale(hand)
    return float(np.clip((d - 0.5) / (1.2 - 0.5), 0.0, 1.0))


def extensions(hand: Hand) -> dict:
    """Per-digit extension in [0,1] (1 = extended, 0 = curled)."""
    ext = {name: 1.0 - _finger_curl(hand, tip, mcp) for name, (tip, mcp) in _FINGER_LM.items()}
    ext["thumb"] = _thumb_extended(hand)
    return ext


# --------------------------------------------------------------------------- averaged scorers
def fist_confidence(hand: Hand) -> float:
    """Four fingers curled (thumb unconstrained). Covers fist and S-handshape."""
    return float(np.mean(_all_curls(hand)))


def a_confidence(hand: Hand) -> float:
    """Letter A: four fingers curled AND thumb extended alongside (not wrapped across)."""
    return float(min(fist_confidence(hand), _thumb_extended(hand)))


def index_confidence(hand: Hand) -> float:
    """Index finger extended, the other three curled (1-hand / D / pointing).

    Both conditions are required via min(), not averaged: an averaged 0.5/0.5 split let a fully
    OPEN hand (index extended, but nothing curled) score exactly 0.5 — equal to WRITE/FRIEND's
    min_confidence threshold, so a flat palm could pass as the pinch/point handshape. min() matches
    every other two-condition scorer in this module (a_confidence, the _PATTERNS dispatch).
    """
    curls = _all_curls(hand)
    index_extended = 1.0 - curls[0]
    rest_curled = float(min(curls[1:]))
    return float(np.clip(min(index_extended, rest_curled), 0.0, 1.0))


def open_confidence(hand: Hand) -> float:
    """Open / flat hand: all four fingers extended (B-hand / flat palm / 5)."""
    return float(np.clip(1.0 - float(np.mean(_all_curls(hand))), 0.0, 1.0))


def claw_confidence(hand: Hand) -> float:
    """Fingers clearly curled but not fully closed (E-hand / bent-5 approximation).

    Used for MEDICINE and EMERGENCY. Generously scored; the repeated-motion detector carries the
    discriminating weight for those signs, so the handshape only confirms the hand is closed-ish.
    """
    curls = _all_curls(hand)
    m = float(np.mean(curls))
    base = float(np.clip((m - 0.25) / 0.35, 0.0, 1.0))   # 0 at flat, saturates ~0.60
    # A claw has ALL fingers similarly (partly) curled. A wide SPREAD of curls means some fingers
    # are fully out and some fully in — that's a finger-counting shape (n / w / index), not a claw.
    # Penalising spread stops a 2-finger "n" hand (mean curl ~0.5) from reading as a claw.
    spread = float(np.std(curls))
    penalty = float(np.clip(1.0 - max(0.0, spread - 0.15) / 0.35, 0.0, 1.0))
    return float(base * penalty)


def flat_o_confidence(hand: Hand) -> float:
    """Flattened-O: fingertips lightly curled toward the thumb (MORE), NOT the deeper curl of a claw.

    Real recorded MORE takes are noisy: mean finger curl ranged from ~0.02 to ~0.17 across separate
    attempts at the "same" gesture — well under claw's 0.25 floor (tuned for MEDICINE/EMERGENCY's
    deeper bent-5), which reads even a good attempt as exactly 0. The documented wrong-shape
    confusor (a genuinely flat/open hand) measures curl ~0 with no observed variance, so there is a
    wide, safe margin between "any real attempt" and "flat open hand" — this floor is set low enough
    to clear the WEAKEST observed real attempt rather than the average one.
    """
    curls = _all_curls(hand)
    m = float(np.mean(curls))
    base = float(np.clip(m / 0.05, 0.0, 1.0))   # 0 at flat, full credit by curl ~0.05
    spread = float(np.std(curls))
    penalty = float(np.clip(1.0 - max(0.0, spread - 0.15) / 0.35, 0.0, 1.0))
    return float(base * penalty)


# --------------------------------------------------------------------------- exact patterns
# 1 = must be extended, 0 = must be curled, absent = don't care. Scored by _match as the MIN over
# the listed fingers, so EVERY condition must hold — an open hand can't pass a 2- or 3-finger shape
# (the averaged scorers used to give an open hand ~0.75 on "w", which let WATER pass for any hand).
_PATTERNS = {
    "point": dict(index=1, middle=0, ring=0, pinky=0),
    "1": dict(index=1, middle=0, ring=0, pinky=0),
    "v": dict(index=1, middle=1, ring=0, pinky=0),
    "l": dict(thumb=1, index=1, middle=0, ring=0, pinky=0),
    "y": dict(thumb=1, index=0, middle=0, ring=0, pinky=1),
    # finger-count shapes for the hospital signs (every finger condition required):
    "n": dict(index=1, middle=1, ring=0, pinky=0),      # 2 fingers — NURSE
    "h": dict(index=1, middle=1, ring=0, pinky=0),      # H = same 2-finger shape — HOSPITAL
    "u": dict(index=1, middle=1, ring=0, pinky=0),
    "w": dict(index=1, middle=1, ring=1, pinky=0),      # 3 fingers — WATER
    "middle": dict(index=0, middle=1, ring=0, pinky=0), # SICK
    # thumb=0 is required here (unlike y) so an actual Y-hand (thumb+pinky out) can't pass as I.
    "i": dict(thumb=0, index=0, middle=0, ring=0, pinky=1),  # pinky only — LETTER_I
}


def _match(hand: Hand, pattern: dict) -> float:
    ext = extensions(hand)
    scores = [ext[f] if target == 1 else 1.0 - ext[f] for f, target in pattern.items()]
    return float(min(scores)) if scores else 0.0


# --------------------------------------------------------------------------- dispatch
_DISPATCH = {
    "fist": fist_confidence,
    "s": fist_confidence,
    "a": a_confidence,
    "index": index_confidence,
    "open": open_confidence,
    "b": open_confidence,
    "5": open_confidence,
    "claw": claw_confidence,
    "flat_o": flat_o_confidence,
}


def handshape_confidence(hand: Hand, kind: str) -> float:
    """Confidence in [0, 1] that `hand` forms handshape `kind`. Unknown kinds score 0."""
    kind = kind.lower()
    fn = _DISPATCH.get(kind)
    if fn is not None:
        return fn(hand)
    pattern = _PATTERNS.get(kind)
    return _match(hand, pattern) if pattern is not None else 0.0
