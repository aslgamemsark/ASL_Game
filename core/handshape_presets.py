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
}


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


def _thumb_chain(extended: bool) -> np.ndarray:
    """thumb mcp, ip, tip (3 points, 2D). cmc is fixed; the rest interpolate cmc->tip."""
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
    mcp_t, ip_t, tip_t = _thumb_chain(thumb_out)
    pts[1, :2] = _THUMB_CMC                       # thumb cmc
    pts[2, :2], pts[3, :2], pts[4, :2] = mcp_t, ip_t, tip_t   # mcp, ip, tip

    base = {"index": 5, "middle": 9, "ring": 13, "pinky": 17}
    for name, e in zip(_FINGER_ORDER, extensions):
        i = base[name]
        pts[i, :2] = _MCP[name]                  # mcp
        chain = _finger_chain(name, e)           # pip, dip, tip
        pts[i + 1, :2], pts[i + 2, :2], pts[i + 3, :2] = chain

    pts[:, :2] *= scale
    if mirror:
        pts[:, 0] *= -1.0
    return pts
