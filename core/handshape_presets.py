"""Phase 2 — Handshape preset library (the inverse of core.handshape).

The recognition side (`core.handshape`) reads 21 hand landmarks and scores how well they form a
named handshape. The synthesis side does the opposite: given a handshape NAME, it deterministically
*produces* a canonical set of 21 landmarks that the recognition predicates score highly. This is a
finite, one-time data task — exactly the "discrete data-lookup" the procedural-avatar report calls
for (Phase 2): the system never re-derives a handshape dynamically, it looks one up.

Because `core.handshape`'s predicates are built from rotation/translation-invariant distance ratios
(tip-vs-knuckle reach, thumb spread relative to hand scale), a preset only needs the right *radial*
finger geometry — it works regardless of where the arm later carries the hand in the frame. Phase 5
(`core.synthesis`) translates and orients these local poses into body-relative position.

Topology is the standard MediaPipe 21-point hand (see core.landmarks): wrist, then thumb
(cmc/mcp/ip/tip) and four fingers (mcp/pip/dip/tip). Local coordinates put the wrist at the origin
with the fingers pointing "up" the image (toward -y) and the palm toward the camera; z stays 0 so a
well-defined palm normal points at the camera.

Each entry of SHAPE_SPECS is (per-finger extension in [0,1] for index/middle/ring/pinky,
thumb_extended bool). 1.0 = fully extended, 0.0 = fully curled; intermediate values (the claw) sit
partway. These specs are the single source of truth shared by every sign that reuses the shape.
"""
from __future__ import annotations

import numpy as np

# Local hand scale (px): the wrist->middle-knuckle distance. Synthesis may rescale per avatar size.
CANON_SCALE = 60.0

# Knuckle (MCP) positions as multiples of CANON_SCALE, fingers pointing up (-y). middle_mcp sits at
# ~1.0 scale from the wrist so it defines the hand scale the predicates normalize against.
_MCP = {
    "index": np.array([-0.35, -0.95]),
    "middle": np.array([-0.10, -1.00]),
    "ring": np.array([0.15, -0.95]),
    "pinky": np.array([0.38, -0.82]),
}
_FINGER_ORDER = ("index", "middle", "ring", "pinky")

# Radial reach of pip/dip/tip as multiples of the knuckle distance |mcp|. An extended finger throws
# its tip well past the knuckle (ratio ~1.8 -> reads "extended"); a curled finger folds the tip back
# inside the knuckle (ratio ~0.80 -> reads "curled"). Intermediate extension lerps between the two.
# Curled chain stays monotonically inside the knuckle (no spike past the MCP) so a fist reads as a
# rounded fist rather than splayed spikes; extended throws the tip well past the knuckle.
_CHAIN_CURLED = np.array([0.95, 0.82, 0.74])
_CHAIN_EXTENDED = np.array([1.30, 1.58, 1.82])

# Thumb tip positions (in scale units): extended thumb juts away from the index knuckle (large spread
# relative to hand scale -> reads "extended"); tucked thumb crosses toward the palm (small spread).
_THUMB_CMC = np.array([-0.25, -0.20])
_THUMB_TIP_OUT = np.array([-1.25, -0.25])
_THUMB_TIP_TUCKED = np.array([0.00, -0.62])
# T-specific: thumb tip wedged between the index/middle knuckles, distinct from the generic
# tucked position (which fist/S/etc. reuse) — T is the only shape needing this exact spot. A real
# recorded pair found genuine T's thumb sits ~0.35 hand-scale units from the index/middle-MCP
# midpoint (farther than a relaxed fist's ~0.18, not closer as originally assumed).
_THUMB_TIP_BETWEEN = np.array([-0.15, -0.60])
# O/F-specific: thumb tip reaches toward the (partially curled) index fingertip to form the
# pinch/circle, distinct from the generic tucked position.
_THUMB_TIP_PINCH = np.array([-0.40, -1.05])
# K-specific: thumb tip touches the middle finger's BASE (MCP) — calibrated for the upright K shape.
_THUMB_TIP_K_TOUCH = np.array([-0.05, -0.50])
# P-specific: after the 185.71° rotation (hand pointing down), the thumb's pre-rotation position
# that lands near MIDDLE_PIP (~0.25 units) in the final pose. P checks MIDDLE_PIP, not MIDDLE_MCP.
_THUMB_TIP_P_TOUCH = np.array([-0.15, -1.05])
# N-specific: thumb tucked under the index/middle fingers specifically, a different depth than
# T's "between the knuckles" position.
_THUMB_TIP_N_UNDER = np.array([-0.12, -0.80])
# A-specific: thumb resting alongside the index (not wrapped across the front like S, not fully
# splayed out like L/Y). A real recording found genuine A's thumb sits ~0.57 hand-scale units
# from INDEX_MCP — the generic OUT position (~1.14 units away, built for L/Y) reads as far too
# extended for A's own predicate, so A needs its own spot rather than reusing OUT.
_THUMB_TIP_A = np.array([-0.75, -0.55])
# C-specific: thumb curved separately from the fingers with a clear open gap (core.handshape's
# c_confidence wants thumb-tip-to-index-fingertip distance ~0.70 hand-scale units, distinguishing
# it from O/F's pinch-closed thumb).
_THUMB_TIP_C = np.array([-0.55, -0.85])
# M-specific: thumb tucked under THREE knuckles (index+middle+ring), one more than N's two — a
# shallower "under" position than N's since it sits centered under a wider knuckle span
# (core.handshape's m_confidence wants thumb-tip-to-3-knuckle-midpoint distance ~0.42 units).
_THUMB_TIP_M_UNDER = np.array([-0.10, -0.55])
# E-specific: reusing the generic TUCKED position made E geometrically identical to a plain
# fist/S — a real user test found a fist scored E's predicate at a perfect 1.0. core.handshape's
# e_confidence wants thumb-tip-to-fingertip-midpoint distance ~0.355 units — recalibrated
# 2026-07-15 against a dedicated correct-vs-fist confusor recording after an initial 0.44 target
# (from an older, differently-posed recording) still accepted a real fist live.
_THUMB_TIP_E_UNDER = np.array([-0.17, -0.37])
# B-specific: reusing the generic TUCKED position made B geometrically identical to 5 by
# b_confidence's real-data-calibrated thumb-tucked check (both land >0.29 hand-scale units from
# INDEX_MCP — see core.handshape's THUMB_TUCKED_LOW/HIGH comment, calibrated 2026-07-23 against a
# real B/5 confusor recording). This position sits ~0.18 units from INDEX_MCP, comfortably inside
# the "tucked" band.
_THUMB_TIP_B_TUCKED = np.array([-0.20, -0.85])

# (index, middle, ring, pinky) extension, thumb_extended. Aliases share one spec so a sign asking for
# "s" and one asking for "fist" animate identically — the same reuse the recognition dispatch relies on.
SHAPE_SPECS: dict[str, tuple[tuple[float, float, float, float], bool]] = {
    "fist":   ((0.0, 0.0, 0.0, 0.0), False),
    "s":      ((0.0, 0.0, 0.0, 0.0), False),
    "a":      ((0.0, 0.0, 0.0, 0.0), True),   # fist + thumb alongside
    "open":   ((1.0, 1.0, 1.0, 1.0), True),
    "b":      ((1.0, 1.0, 1.0, 1.0), True),
    "5":      ((1.0, 1.0, 1.0, 1.0), True),
    "claw":   ((0.40, 0.40, 0.40, 0.40), True),
    "flat_o": ((0.65, 0.65, 0.65, 0.65), False),  # lightly curled fingertips, near thumb — MORE
    "index":  ((1.0, 0.0, 0.0, 0.0), False),
    "point":  ((1.0, 0.0, 0.0, 0.0), False),
    "1":      ((1.0, 0.0, 0.0, 0.0), False),
    "v":      ((1.0, 1.0, 0.0, 0.0), False),
    "l":      ((1.0, 0.0, 0.0, 0.0), True),   # index + thumb
    "y":      ((0.0, 0.0, 0.0, 1.0), True),   # pinky + thumb
    "i":      ((0.0, 0.0, 0.0, 1.0), False),  # pinky only — LETTER_I
    "n":      ((1.0, 1.0, 0.0, 0.0), False),
    "h":      ((1.0, 1.0, 0.0, 0.0), False),
    "u":      ((1.0, 1.0, 0.0, 0.0), False),
    "w":      ((1.0, 1.0, 1.0, 0.0), False),
    "middle": ((0.0, 1.0, 0.0, 0.0), False),
    "f":      ((0.30, 1.0, 1.0, 1.0), False),   # index curls toward thumb; rest extended
    "o":      ((0.50, 0.50, 0.50, 0.50), False),  # moderate curl, all fingertips toward thumb
    "d":      ((1.0, 0.0, 0.0, 0.0), False),    # index up, thumb tucked (not out like L)
    "t":      ((0.0, 0.0, 0.0, 0.0), False),    # fist, thumb tucked between index/middle
    "g":      ((1.0, 0.0, 0.0, 0.0), True),     # index + thumb out, like L but rotated sideways
    "letter_h": ((1.0, 1.0, 0.0, 0.0), False),  # index+middle together, rotated sideways
    "k":      ((1.0, 1.0, 0.0, 0.0), False),    # index+middle spread, thumb touches middle base
    "letter_n": ((0.0, 0.0, 0.0, 0.0), False),  # fist, thumb tucked under index/middle
    "p":      ((1.0, 1.0, 0.0, 0.0), False),    # same as k, rotated to point downward
    "q":      ((1.0, 0.0, 0.0, 0.0), True),     # same as g, rotated to point downward
    "r":      ((1.0, 1.0, 0.0, 0.0), False),    # index+middle extended and crossed
    # Dispatched under a distinct key from their generic-shape namesakes because
    # core.handshape scores them with a separately calibrated predicate (see that module's
    # letter_s_confidence/c_confidence/e_confidence/m_confidence/x_confidence docstrings).
    "letter_s": ((0.0, 0.0, 0.0, 0.0), False),  # closed fist, thumb wrapped across the front
    "c":      ((0.85, 0.85, 0.85, 0.85), False),  # gentle curved arc, thumb apart with a clear gap
    "e":      ((0.0, 0.0, 0.0, 0.0), False),    # fingers curled toward palm, thumb tucked under
    "m":      ((0.0, 0.0, 0.0, 0.0), False),    # fist, thumb tucked under index/middle/ring
    "x":      ((0.752, 0.0, 0.0, 0.0), False),  # index hooked at one knuckle, rest curled
}

# Extra whole-hand rotation (degrees) applied after the base shape is built, for letters whose
# defining feature is hand ORIENTATION rather than finger extension (G/H point sideways, P/Q
# point downward — see local_hand()'s corresponding predicate for why 2D extension alone can't
# capture this).
# p: 157.71 (not a plain 180 straight-down rotation) — recalibrated 2026-07-14 to match a real P
# recording's measured middle-finger MCP->TIP angle (~152deg, not a mathematically perfect
# straight-down 180deg; see p_confidence()'s orientation check in core/handshape.py).
_ROTATION_DEG = {"g": 110.225, "letter_h": 90.0, "p": 157.71, "q": 200.225}


def supported_shapes() -> list[str]:
    return sorted(SHAPE_SPECS.keys())


# --- MEASURED handshape (inverse of presets): read real per-finger curl from a captured pose -------
# MediaPipe hand topology: wrist=0, then thumb(1-4) and index/middle/ring/pinky each (mcp,pip,dip,tip).
_MP_FINGERS = {"index": (5, 6, 7, 8), "middle": (9, 10, 11, 12),
               "ring": (13, 14, 15, 16), "pinky": (17, 18, 19, 20)}
_MP_THUMB = (1, 2, 3, 4)
_FLEX_STRAIGHT_DEG = 15.0    # a finger this straight reads as fully extended (frac 0)
_FLEX_CURLED_DEG = 150.0     # this bent reads as fully curled (frac 1)


def _angle(a: np.ndarray, b: np.ndarray) -> float:
    a = a / (np.linalg.norm(a) or 1.0)
    b = b / (np.linalg.norm(b) or 1.0)
    return float(np.degrees(np.arccos(np.clip(a.dot(b), -1.0, 1.0))))


def measure_pose(pose) -> dict:
    """A captured 21x3 hand pose -> measured per-finger curl fraction [0,1] and thumb extension.

    Curl is the angle between each finger's proximal phalanx (mcp->pip) and its distal segment
    (dip->tip): ~0deg straight, ~180deg fully folded. Rotation/translation invariant, so it is
    independent of where the arm carries the hand. The four-finger order is index, middle, ring,
    pinky (matching SHAPE_SPECS ext order).
    """
    p = np.asarray(pose, dtype=float)
    flex = []
    for name in ("index", "middle", "ring", "pinky"):
        mcp, pip, dip, tip = _MP_FINGERS[name]
        deg = _angle(p[pip] - p[mcp], p[tip] - p[dip])
        frac = (deg - _FLEX_STRAIGHT_DEG) / (_FLEX_CURLED_DEG - _FLEX_STRAIGHT_DEG)
        flex.append(round(float(np.clip(frac, 0.0, 1.0)), 3))
    # thumb extension: straight thumb (small bend at IP) + tip far from index mcp reads as extended
    tcmc, tmcp, tip_, ttip = _MP_THUMB
    tbend = _angle(p[tmcp] - p[tcmc], p[ttip] - p[tip_])
    thumb_ext = float(np.clip(1.0 - (tbend - _FLEX_STRAIGHT_DEG) / 90.0, 0.0, 1.0))
    return {"flex": flex, "thumb": round(thumb_ext, 3)}


def _finger_chain(name: str, extension: float) -> np.ndarray:
    """pip, dip, tip (3 points, 2D) for one finger at the given extension in [0, 1]."""
    mcp = _MCP[name]
    reach = np.linalg.norm(mcp)
    unit = mcp / reach
    mults = _CHAIN_CURLED + (_CHAIN_EXTENDED - _CHAIN_CURLED) * float(np.clip(extension, 0.0, 1.0))
    return np.array([unit * (m * reach) for m in mults])


def _thumb_chain(extended: bool, between: bool = False, pinch: bool = False,
                 k_touch: bool = False, p_touch: bool = False, n_under: bool = False,
                 a_alongside: bool = False, c_shape: bool = False,
                 m_under: bool = False, e_under: bool = False, b_tucked: bool = False) -> np.ndarray:
    """thumb mcp, ip, tip (3 points, 2D). cmc is fixed; the rest interpolate cmc->tip."""
    if between:
        tip = _THUMB_TIP_BETWEEN
    elif pinch:
        tip = _THUMB_TIP_PINCH
    elif k_touch:
        tip = _THUMB_TIP_K_TOUCH
    elif p_touch:
        tip = _THUMB_TIP_P_TOUCH
    elif n_under:
        tip = _THUMB_TIP_N_UNDER
    elif a_alongside:
        tip = _THUMB_TIP_A
    elif c_shape:
        tip = _THUMB_TIP_C
    elif m_under:
        tip = _THUMB_TIP_M_UNDER
    elif e_under:
        tip = _THUMB_TIP_E_UNDER
    elif b_tucked:
        tip = _THUMB_TIP_B_TUCKED
    else:
        tip = _THUMB_TIP_OUT if extended else _THUMB_TIP_TUCKED
    return np.array([_THUMB_CMC + (tip - _THUMB_CMC) * f for f in (0.40, 0.72, 1.0)])


def local_hand(kind: str, scale: float = CANON_SCALE, mirror: bool = False) -> np.ndarray:
    """Canonical 21x3 landmark array for a handshape, wrist at origin, in pixel units.

    `mirror` flips x (a left/right hand pair facing each other) — purely cosmetic for rendering;
    every recognition predicate is mirror-invariant. Raises KeyError for an unsupported kind so a
    typo in a sign definition fails loudly rather than silently animating an empty hand.
    """
    key = kind.lower()
    if key not in SHAPE_SPECS:
        raise KeyError(
            f"No handshape preset for '{kind}'. Known: {', '.join(supported_shapes())}"
        )
    extensions, thumb_out = SHAPE_SPECS[key]

    pts = np.zeros((21, 3), dtype=float)        # index 0 = wrist = origin
    mcp_t, ip_t, tip_t = _thumb_chain(
        thumb_out,
        between=(key == "t"),
        pinch=(key in ("o", "f")),
        k_touch=(key == "k"),
        p_touch=(key == "p"),
        n_under=(key == "letter_n"),
        a_alongside=(key == "a"),
        c_shape=(key == "c"),
        m_under=(key == "m"),
        e_under=(key == "e"),
        b_tucked=(key == "b"),
    )
    pts[1, :2] = _THUMB_CMC                       # thumb cmc
    pts[2, :2], pts[3, :2], pts[4, :2] = mcp_t, ip_t, tip_t   # mcp, ip, tip

    base = {"index": 5, "middle": 9, "ring": 13, "pinky": 17}
    for name, e in zip(_FINGER_ORDER, extensions):
        i = base[name]
        pts[i, :2] = _MCP[name]                  # mcp
        chain = _finger_chain(name, e)           # pip, dip, tip
        pts[i + 1, :2], pts[i + 2, :2], pts[i + 3, :2] = chain

    if key == "r":
        # Letter R: index and middle fingers cross — swap their DIP/TIP x-offset from center so
        # each finger's tip ends up on the OTHER finger's side, same reach as ring/pinky's setback.
        index_i, middle_i = base["index"], base["middle"]
        pts[index_i + 2, 0], pts[middle_i + 2, 0] = pts[middle_i + 2, 0], pts[index_i + 2, 0]
        pts[index_i + 3, 0], pts[middle_i + 3, 0] = pts[middle_i + 3, 0], pts[index_i + 3, 0]
    elif key in ("letter_h", "u"):
        # H/U: index+middle held TOGETHER (not spread like V/K) — pull both fingers' pip/dip/tip
        # in toward the midline between their two MCPs.
        index_i, middle_i = base["index"], base["middle"]
        mid_x = (_MCP["index"][0] + _MCP["middle"][0]) / 2.0
        for joint in (1, 2, 3):
            pts[index_i + joint, 0] = mid_x + (pts[index_i + joint, 0] - mid_x) * 0.05
            pts[middle_i + joint, 0] = mid_x + (pts[middle_i + joint, 0] - mid_x) * 0.05
    pts[:, :2] *= scale

    rotate_deg = _ROTATION_DEG.get(key, 0.0)
    if rotate_deg:
        rad = np.radians(rotate_deg)
        rot = np.array([[np.cos(rad), -np.sin(rad)], [np.sin(rad), np.cos(rad)]])
        pts[:, :2] = pts[:, :2] @ rot.T

    if mirror:
        pts[:, 0] *= -1.0
    return pts
