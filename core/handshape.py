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
    MIDDLE_PIP,
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


def _thumb_dist(hand: Hand, idx: int) -> float:
    """Distance from thumb tip to another landmark, in hand-scale units."""
    return float(np.linalg.norm(_xy(hand, THUMB_TIP) - _xy(hand, idx))) / _hand_scale(hand)


def _finger_direction_deg(hand: Hand, tip_idx: int, mcp_idx: int) -> float:
    """0deg = this finger's MCP->TIP vector points straight up the image, 90deg = sideways
    (either direction), 180deg = pointing straight down.

    A real recorded G measured the WRIST->MIDDLE-MCP vector (whole-palm orientation) at only ~10
    degrees even with a clean sideways G, because people rotate a single extended finger at its
    own knuckle rather than rotating the whole forearm — the palm barely turns. The finger's own
    direction measured ~80deg on the same recording, which is what actually distinguishes G/H
    (sideways) and P/Q (downward) from their upright counterparts (D/L, K/V/U).
    """
    v = _xy(hand, tip_idx) - _xy(hand, mcp_idx)
    n = float(np.linalg.norm(v))
    if n < 1e-6:
        return 0.0
    up = np.array([0.0, -1.0])
    cos_a = float(np.dot(v, up) / n)
    return float(np.degrees(np.arccos(np.clip(cos_a, -1.0, 1.0))))


def _orientation_score(hand: Hand, tip_idx: int, mcp_idx: int, target_deg: float, tolerance: float = 35.0) -> float:
    angle = _finger_direction_deg(hand, tip_idx, mcp_idx)
    return float(np.clip(1.0 - abs(angle - target_deg) / tolerance, 0.0, 1.0))


def _finger_spread(hand: Hand, tip_a: int, tip_b: int) -> float:
    """Distance between two fingertips, in hand-scale units."""
    return float(np.linalg.norm(_xy(hand, tip_a) - _xy(hand, tip_b))) / _hand_scale(hand)


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
    """Letter A: four fingers curled AND thumb resting alongside the index (not wrapped across
    the front like S, not fully splayed out to the side like L/Y).

    Calibrated against a real recording (2026-07): thumb-tip-to-index-MCP distance measured
    ~0.54-0.60 hand-scale units for a natural A, clearly separated from S's ~0.19-0.21 (thumb
    tucked across front). The generic _thumb_extended() helper targets a much farther "sticking
    out" position (built for L/Y, needs d>=1.2 to score 1.0) and scored a real A at only ~0.10 —
    a dedicated target replaces it here.
    """
    fist_score = float(np.mean(_all_curls(hand)))
    d = _thumb_dist(hand, INDEX_MCP)
    thumb_alongside = float(np.clip(1.0 - abs(d - 0.57) / 0.30, 0.0, 1.0))
    return float(min(fist_score, thumb_alongside))


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

    Real recorded MORE takes are noisy: mean finger curl ranged ~0.02-0.29 across separate attempts
    at the "same" gesture — well under claw's 0.25 floor (tuned for MEDICINE/EMERGENCY's deeper
    bent-5), which reads even a good attempt as exactly 0. The documented wrong-shape confusor (a
    genuinely flat/open hand) measures curl ~0 with no observed variance, so there is a wide, safe
    margin between "any real attempt" and "flat open hand" — the LOW floor is set to clear the
    weakest observed real attempt rather than the average one.

    Bug found 2026-07-14 (live user testing): this had no CEILING, only a floor — a plain fist
    (curl ~1.0) or claw (~0.71) scored the exact same 1.0 as a real flattened-O, since `base` only
    ever clips UP to 1.0 and never falls back down for deeper curls ("MORE passes even with fists").
    Added a ceiling that holds full credit through the observed real-attempt range (up to ~0.29,
    and the committed more_confusor.json fixture's held claw-ish 0.50) and falls to 0 by curl 0.65
    — clear of claw's ~0.71 and fist's ~1.0, both fully rejected.
    """
    curls = _all_curls(hand)
    m = float(np.mean(curls))
    base = float(np.clip(m / 0.05, 0.0, 1.0))   # 0 at flat, full credit by curl ~0.05
    ceiling = float(np.clip((0.65 - m) / 0.15, 0.0, 1.0))  # full credit to ~0.50, 0 by 0.65 (claw/fist)
    spread = float(np.std(curls))
    penalty = float(np.clip(1.0 - max(0.0, spread - 0.15) / 0.35, 0.0, 1.0))
    return float(base * ceiling * penalty)


# --------------------------------------------------------------------------- pinch-based letters
# Distance bands (hand-scale units) for "thumb tip touching a fingertip":
_PINCH_NEAR = 0.35   # at/inside this distance, fully counts as touching
_PINCH_FAR = 0.90    # at/beyond this distance, fully counts as not touching


def _pinch_score(hand: Hand, tip_idx: int) -> float:
    d = _thumb_dist(hand, tip_idx)
    return float(np.clip((_PINCH_FAR - d) / (_PINCH_FAR - _PINCH_NEAR), 0.0, 1.0))


def f_confidence(hand: Hand) -> float:
    """Letter F: thumb and index tip touch (forming a small circle); middle/ring/pinky extended."""
    pinch = _pinch_score(hand, INDEX_TIP)
    ext = extensions(hand)
    others = float(min(ext["middle"], ext["ring"], ext["pinky"]))
    return float(min(pinch, others))


def o_confidence(hand: Hand) -> float:
    """Letter O: all four fingertips curl in to meet the thumb, forming a rounded circle.

    Distinct from flat_o (MORE)'s very light curl and from claw's deeper, thumb-unconstrained
    curl: O specifically requires the THUMB to be near the fingertips too, not just the fingers
    curling on their own.
    """
    curls = _all_curls(hand)
    m = float(np.mean(curls))
    curl_score = float(np.clip(1.0 - abs(m - 0.5) / 0.35, 0.0, 1.0))  # peaks around curl ~0.5
    pinch = _pinch_score(hand, INDEX_TIP)
    spread = float(np.std(curls))
    penalty = float(np.clip(1.0 - max(0.0, spread - 0.15) / 0.35, 0.0, 1.0))
    return float(min(curl_score, pinch) * penalty)


def d_confidence(hand: Hand) -> float:
    """Letter D: index extended upward; middle/ring/pinky curl in toward the thumb, which stays
    tucked (not held out to the side like L)."""
    curls = _all_curls(hand)
    index_extended = 1.0 - curls[0]
    rest_curled = float(min(curls[1:]))
    thumb_tucked = 1.0 - _thumb_extended(hand)
    return float(min(index_extended, rest_curled, thumb_tucked))


def t_confidence(hand: Hand) -> float:
    """Letter T: closed fist with the thumb tip tucked between the index and middle knuckles
    (distinct from A's thumb resting alongside the index).

    A real recorded pair found the distance from thumb tip to the index/middle-MCP midpoint runs
    the OPPOSITE direction from the original assumption: a relaxed plain fist's thumb sits CLOSE
    to that midpoint (~0.18 hand-scale units), while a deliberate T pushes the thumb tip further
    up between the knuckles, LANDING FARTHER from it (~0.35-0.37). This is a band around T's real
    value, not a one-sided "closer is better" threshold — L/A/Y hold the thumb out to the side at
    ~1.25, even farther than T, so a one-sided "farther is better" rule would also (wrongly) accept
    those.
    """
    fist_score = float(np.mean(_all_curls(hand)))
    mcp_mid = (_xy(hand, INDEX_MCP) + _xy(hand, MIDDLE_MCP)) / 2.0
    d = float(np.linalg.norm(_xy(hand, THUMB_TIP) - mcp_mid)) / _hand_scale(hand)
    thumb_between = float(np.clip(1.0 - abs(d - 0.35) / 0.14, 0.0, 1.0))
    return float(min(fist_score, thumb_between))


def v_confidence(hand: Hand) -> float:
    """Letter V: index + middle extended AND held apart (spread) — a real recorded confusor found
    the plain finger-count pattern alone (used elsewhere for N/H/U) lets a JOINED 2-finger hand
    pass as V too, since extension alone doesn't check separation between the two fingertips."""
    pattern_score = _match(hand, {"index": 1, "middle": 1, "ring": 0, "pinky": 0})
    spread = float(np.linalg.norm(_xy(hand, INDEX_TIP) - _xy(hand, MIDDLE_TIP))) / _hand_scale(hand)
    spread_score = float(np.clip((spread - 0.15) / (0.40 - 0.15), 0.0, 1.0))
    return float(min(pattern_score, spread_score))


def _together_score(hand: Hand) -> float:
    """High when index+middle tips are held CLOSE together (opposite of V's spread requirement).

    A real recorded H (fingers deliberately held together) measured spread ~0.255 hand-scale
    units — the original 0.05-0.20 "together" band was calibrated too tight and scored it 0. A
    real plain V measured ~0.816 on the same metric, so there is a wide, safe gap to place this
    band in: full credit up to ~0.15, fading out by 0.6, well short of V's real value.
    """
    spread = _finger_spread(hand, INDEX_TIP, MIDDLE_TIP)
    return float(np.clip((0.60 - spread) / (0.60 - 0.15), 0.0, 1.0))


def letter_h_confidence(hand: Hand) -> float:
    """Letter H: index+middle extended TOGETHER (not spread like V), hand rotated sideways.

    Dispatched as "letter_h", NOT "h" — HOSPITAL and NAME already use kind="h" for their own,
    differently-calibrated 2-finger check (no orientation/spread constraint); reusing "h" here
    would silently change their behavior.
    """
    pattern_score = _match(hand, {"index": 1, "middle": 1, "ring": 0, "pinky": 0})
    together = _together_score(hand)
    orient = _orientation_score(hand, INDEX_TIP, INDEX_MCP, target_deg=90.0)
    return float(min(pattern_score, together, orient))


def u_confidence(hand: Hand) -> float:
    """Letter U: index+middle extended TOGETHER, held upright (not rotated like H)."""
    pattern_score = _match(hand, {"index": 1, "middle": 1, "ring": 0, "pinky": 0})
    together = _together_score(hand)
    orient = _orientation_score(hand, INDEX_TIP, INDEX_MCP, target_deg=0.0)
    return float(min(pattern_score, together, orient))


def _k_thumb_touch(hand: Hand) -> float:
    """How close the thumb tip is to K/P's real touch distance from the middle-MCP.

    A real recorded pair found this runs the OPPOSITE direction from the original assumption
    (same mistake as T's thumb-position bug): a relaxed V's thumb naturally rests close to the
    middle-MCP already (~0.17 hand-scale units, since the thumb's resting position is near the
    palm center) — reusing the generic "touching" pinch score always saturated to 1.0 for a plain
    V, so V freely passed as K. Genuine K reaches the thumb tip FARTHER out to the middle-MCP
    (~0.46-0.53), so this is a band around K's real value, not a "closer is better" pinch.
    """
    d = _thumb_dist(hand, MIDDLE_MCP)
    return float(np.clip(1.0 - abs(d - 0.49) / 0.20, 0.0, 1.0))


def k_confidence(hand: Hand) -> float:
    """Letter K: index+middle spread apart (like V), thumb touches the middle finger's BASE
    (MCP), not its tip — distinct from V (no thumb constraint) and F (thumb touches index tip)."""
    v_pattern = _match(hand, {"index": 1, "middle": 1, "ring": 0, "pinky": 0})
    spread = _finger_spread(hand, INDEX_TIP, MIDDLE_TIP) / 1.0
    spread_score = float(np.clip((spread - 0.15) / (0.40 - 0.15), 0.0, 1.0))
    thumb_touch = _k_thumb_touch(hand)
    return float(min(v_pattern, spread_score, thumb_touch))


def g_confidence(hand: Hand) -> float:
    """Letter G: index extended, thumb held out roughly parallel to it (like L), hand rotated
    sideways so the index points across rather than up.

    Uses the INDEX FINGER's own MCP->TIP direction, not the whole hand's wrist->palm direction —
    a real recorded G measured the whole-palm angle at only ~10deg even with a clean sideways G,
    since people rotate the finger at its own knuckle rather than the whole forearm; the finger's
    own direction measured ~80deg on the same recording.
    """
    index_pattern = _match(hand, {"index": 1, "middle": 0, "ring": 0, "pinky": 0})
    thumb_out = _thumb_extended(hand)
    orient = _orientation_score(hand, INDEX_TIP, INDEX_MCP, target_deg=90.0)
    return float(min(index_pattern, thumb_out, orient))


def q_confidence(hand: Hand) -> float:
    """Letter Q: same handshape as G, rotated to point downward instead of sideways."""
    index_pattern = _match(hand, {"index": 1, "middle": 0, "ring": 0, "pinky": 0})
    thumb_out = _thumb_extended(hand)
    orient = _orientation_score(hand, INDEX_TIP, INDEX_MCP, target_deg=180.0)
    return float(min(index_pattern, thumb_out, orient))


def _p_thumb_pos(hand: Hand) -> float:
    """Thumb-position check for P: when the hand points downward the thumb naturally rests near
    MIDDLE_PIP (~0.25 hand-scale units), NOT the MIDDLE_MCP it targets in K (which ends up ~0.86
    away — the opposite side of the hand). Band-pass calibrated from real P recordings."""
    d = _thumb_dist(hand, MIDDLE_PIP)
    return float(np.clip(1.0 - abs(d - 0.25) / 0.18, 0.0, 1.0))


def p_confidence(hand: Hand) -> float:
    """Letter P: K-like V-shape with both fingers pointing downward, thumb near middle-PIP.

    Two components needed real-recording recalibration (2026-07-14), both from the same root
    cause as the G/H fix: pointing the hand DOWNWARD distorts the wrist-relative geometry these
    checks were tuned against upright.
      - middle-finger curl: _finger_curl's tip/wrist-vs-mcp/wrist RATIO reads a genuinely extended
        middle finger as only ~0.25 "extended" (0.75 "curled") when the hand points down, vs
        index's normal ~0.73 — the ratio assumes an upright reference. A real P recording measured
        this consistently (median 0.25, idle/rapid confusors measured ~0.0-0.01), so rather than
        touching the shared `extensions()`/`_finger_curl` used by every other letter, P uses its
        own low floor for the middle finger specifically: it only asks for >=0.20, and confusors
        stay ~15x below that.
      - orientation: target_deg was 180 (straight down); a real P's own MCP->TIP angle measured
        152 (median, tight IQR 150-153), not 180 — recentered to match.
    """
    ext = extensions(hand)
    index_score = ext["index"]
    middle_score = float(np.clip(ext["middle"] / 0.20, 0.0, 1.0))
    rest_curled = float(min(1.0 - ext["ring"], 1.0 - ext["pinky"]))
    spread = _finger_spread(hand, INDEX_TIP, MIDDLE_TIP)
    spread_score = float(np.clip((spread - 0.15) / (0.40 - 0.15), 0.0, 1.0))
    thumb_touch = _p_thumb_pos(hand)
    orient = _orientation_score(hand, MIDDLE_TIP, MIDDLE_MCP, target_deg=152.0)
    return float(min(index_score, middle_score, rest_curled, spread_score, thumb_touch, orient))


def r_confidence(hand: Hand) -> float:
    """Letter R: index and middle extended and CROSSED (their left-right order at the tip is
    swapped relative to their order at the knuckle), ring+pinky curled."""
    both_extended = float(min(1.0 - _finger_curl(hand, INDEX_TIP, INDEX_MCP),
                              1.0 - _finger_curl(hand, MIDDLE_TIP, MIDDLE_MCP)))
    ext = extensions(hand)
    rest_curled = float(min(1.0 - ext["ring"], 1.0 - ext["pinky"]))
    mcp_dx = _xy(hand, MIDDLE_MCP)[0] - _xy(hand, INDEX_MCP)[0]
    tip_dx = _xy(hand, MIDDLE_TIP)[0] - _xy(hand, INDEX_TIP)[0]
    scale = _hand_scale(hand)
    # Positive when the tip order has flipped relative to the knuckle order (crossed).
    crossing = -np.sign(mcp_dx) * tip_dx / scale if mcp_dx != 0 else 0.0
    crossed_score = float(np.clip(crossing / 0.15, 0.0, 1.0))
    return float(min(both_extended, rest_curled, crossed_score))


def c_confidence(hand: Hand) -> float:
    """Letter C: fingers curved together with a clear open gap to the thumb, distinguishing it
    from O (thumb pinches closed against the fingers) and fist (much more curled).

    Calibrated against a real recording (2026-07): a real C's gentle arc barely registers on the
    tip/wrist curl ratio (measured mean curl ~0.00-0.03 — it's an arc, not a knuckle fold, so the
    old 0.35 curl target was never reachable), while the thumb-to-index-fingertip gap measured a
    consistent ~0.60-0.75, which is what actually separates it from O's pinch.
    """
    curls = _all_curls(hand)
    m = float(np.mean(curls))
    curl_score = float(np.clip(1.0 - m / 0.4, 0.0, 1.0))
    gap = _thumb_dist(hand, INDEX_TIP)
    gap_score = float(np.clip(1.0 - abs(gap - 0.70) / 0.35, 0.0, 1.0))
    return float(min(curl_score, gap_score))


def e_confidence(hand: Hand) -> float:
    """Letter E: all four fingers bent at the middle knuckle, tips pointing toward the palm,
    thumb tucked underneath. High uniform curl, thumb not extended to side."""
    curls = _all_curls(hand)
    m = float(np.mean(curls))
    curl_score = float(np.clip((m - 0.45) / 0.25, 0.0, 1.0))
    thumb_in = 1.0 - _thumb_extended(hand)
    spread = float(np.std(curls))
    uniformity = float(np.clip(1.0 - max(0.0, spread - 0.15) / 0.35, 0.0, 1.0))
    return float(min(curl_score, thumb_in) * uniformity)


def m_confidence(hand: Hand) -> float:
    """Letter M: closed fist with the thumb tucked under the index, middle, AND ring fingers
    (one more finger than N). The thumb-tip-to-three-knuckle-midpoint distance is the key signal.

    Calibrated against a real recording (2026-07): the guessed 0.20 target was roughly half the
    actual measured distance (~0.40-0.44) for this specific 3-knuckle anchor, so a genuine M
    scored 0.0 on the old threshold.
    """
    fist_score = float(np.mean(_all_curls(hand)))
    mcp_mid = (_xy(hand, INDEX_MCP) + _xy(hand, MIDDLE_MCP) + _xy(hand, RING_MCP)) / 3.0
    d = float(np.linalg.norm(_xy(hand, THUMB_TIP) - mcp_mid)) / _hand_scale(hand)
    thumb_under = float(np.clip(1.0 - abs(d - 0.42) / 0.20, 0.0, 1.0))
    return float(min(fist_score, thumb_under))


def letter_s_confidence(hand: Hand) -> float:
    """Letter S: closed fist with the thumb wrapped across the FRONT of the fingers (not to the
    side like A, and not tucked between knuckles like T). Scored as fist + thumb not extended.

    Dispatched as 'letter_s', NOT 's' — other signs use kind='s' as a plain-fist alias which has
    no thumb constraint; reusing it here would add an unintended constraint to those signs.
    """
    fist_score = float(np.mean(_all_curls(hand)))
    thumb_in = 1.0 - _thumb_extended(hand)
    return float(min(fist_score, thumb_in))


def x_confidence(hand: Hand) -> float:
    """Letter X: index finger hooked/bent into a hook shape (partially curled at the middle joint),
    while the remaining three fingers are curled into the palm. Distinct from the index handshape
    (where the index is fully extended) and from a fist (where the index is also fully curled).

    Calibrated against a real recording (2026-07): a real X hook only bends at one knuckle, which
    barely moves the tip/wrist ratio — measured curl ~0.04-0.12, nowhere near the guessed 0.5
    (half-curl) target, so a genuine X previously scored 0.0.
    """
    curls = _all_curls(hand)
    index_hooked = float(np.clip(1.0 - abs(curls[0] - 0.08) / 0.15, 0.0, 1.0))
    rest_curled = float(min(curls[1:]))
    return float(min(index_hooked, rest_curled))


def letter_n_confidence(hand: Hand) -> float:
    """Letter N: closed fist, thumb tucked under the index and middle fingers specifically
    (distinct from a plain fist/A/T's thumb placement). Same 2D-distance-to-knuckle-line
    approach as T; may share T's real-world ambiguity between "under" and "nearby".

    Dispatched as "letter_n", NOT "n" — NURSE already uses kind="n" for its own,
    differently-calibrated 2-finger check; reusing "n" here would silently change its behavior.
    """
    fist_score = float(np.mean(_all_curls(hand)))
    mcp_mid = (_xy(hand, INDEX_MCP) + _xy(hand, MIDDLE_MCP)) / 2.0
    d = float(np.linalg.norm(_xy(hand, THUMB_TIP) - mcp_mid)) / _hand_scale(hand)
    thumb_under = float(np.clip(1.0 - abs(d - 0.20) / 0.12, 0.0, 1.0))
    return float(min(fist_score, thumb_under))


# --------------------------------------------------------------------------- exact patterns
# 1 = must be extended, 0 = must be curled, absent = don't care. Scored by _match as the MIN over
# the listed fingers, so EVERY condition must hold — an open hand can't pass a 2- or 3-finger shape
# (the averaged scorers used to give an open hand ~0.75 on "w", which let WATER pass for any hand).
_PATTERNS = {
    "point": dict(index=1, middle=0, ring=0, pinky=0),
    "1": dict(index=1, middle=0, ring=0, pinky=0),
    "l": dict(thumb=1, index=1, middle=0, ring=0, pinky=0),
    "y": dict(thumb=1, index=0, middle=0, ring=0, pinky=1),
    "w": dict(index=1, middle=1, ring=1, pinky=0),      # 3 fingers — WATER
    "middle": dict(index=0, middle=1, ring=0, pinky=0), # SICK
    # thumb=0 is required here (unlike y) so an actual Y-hand (thumb+pinky out) can't pass as I.
    "i": dict(thumb=0, index=0, middle=0, ring=0, pinky=1),  # pinky only — LETTER_I
}


def _two_finger_confidence(hand: Hand) -> float:
    """Index + middle both extended together, ring + pinky curled — N/H/U's shared 2-finger shape.

    Bug found 2026-07-14 (live user testing): a plain MIN-over-fingers pattern match (what "n"/"h"/
    "u" used before) can't tell "both fingers genuinely extended together" from "only one finger
    intentionally extended, the other incidentally reads partially extended" — real fingers aren't
    independent, so a deliberate single-middle-finger tap still measured index~0.36 via the
    wrist-ratio curl metric. Worse, that confusor's OWN middle-finger score (0.85) was HIGHER than
    a real two-finger N's (0.47) — no threshold on the MIN alone can separate them, since the
    confusor doesn't score lower, just unevenly.

    The real distinguishing feature: genuine N/H execution has index and middle SIMILARLY
    extended (measured gap ~0.04), while the one-finger confusor has one dominant, one weak
    (measured gap ~0.51). Added a parity term alongside the existing per-finger floor.
    """
    ext = extensions(hand)
    both_extended = float(min(ext["index"], ext["middle"]))
    rest_curled = float(min(1.0 - ext["ring"], 1.0 - ext["pinky"]))
    gap = abs(ext["middle"] - ext["index"])
    parity = float(np.clip(1.0 - gap / 0.25, 0.0, 1.0))
    return float(min(both_extended, rest_curled, parity))


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
    "f": f_confidence,
    "o": o_confidence,
    "d": d_confidence,
    "t": t_confidence,
    "v": v_confidence,
    "letter_h": letter_h_confidence,
    "n": _two_finger_confidence,   # NURSE
    "h": _two_finger_confidence,   # HOSPITAL — same 2-finger shape as N
    "u": u_confidence,
    "k": k_confidence,
    "letter_n": letter_n_confidence,
    "g": g_confidence,
    "q": q_confidence,
    "p": p_confidence,
    "r": r_confidence,
    "c": c_confidence,
    "e": e_confidence,
    "m": m_confidence,
    "letter_s": letter_s_confidence,
    "x": x_confidence,
}


def handshape_confidence(hand: Hand, kind: str) -> float:
    """Confidence in [0, 1] that `hand` forms handshape `kind`. Unknown kinds score 0."""
    kind = kind.lower()
    fn = _DISPATCH.get(kind)
    if fn is not None:
        return fn(hand)
    pattern = _PATTERNS.get(kind)
    return _match(hand, pattern) if pattern is not None else 0.0
