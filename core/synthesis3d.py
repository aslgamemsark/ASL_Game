"""3D body-frame synthesis — drives a rigged avatar (the Three.js viewer) from the same schema.

`core/synthesis.py` produces 2D landmark frames for the recognition round-trip. This module produces
the *other* consumer the procedural-avatar report describes: a 3D animation track for an actual rigged
glTF avatar (Ready Player Me). It reuses the SAME `Sign` schema and the SAME trajectory generators
(`core/trajectory.py`), so the avatar and the verifier still share one source of truth.

Output is a small JSON-able dict per sign. All positions are **body-relative**, in shoulder-width
units, in a right-handed body frame (x = avatar's right, y = up, z = forward / toward camera),
expressed as an offset from a named reference bone (Spine2, Head, …). The viewer maps each offset to a
world-space wrist target against the live avatar skeleton — so a clip is independent of the avatar's
size or proportions, exactly the normalization the report mandates.

Per hand we emit a handshape (as the finger-extension spec the viewer turns into bone curls) and a
per-frame target offset (the trajectory). Handshape is constant within a sign; only the hand target
moves.
"""
from __future__ import annotations

import numpy as np

from core import trajectory as tj
from core.handshape_presets import SHAPE_SPECS
from core.schema import Anchor, MovementKind, Sign

# anchor -> (reference bone, base offset [x,y,z] in shoulder-widths, hands in FRONT of the body).
# y is up, z is forward; references are torso/head bones so heights read anatomically.
_ANCHOR_BASE = {
    Anchor.CHEST:         ("Spine1", np.array([0.00, 0.05, 0.45])),    # on the chest, not floating
    Anchor.BELLY:         ("Spine",  np.array([0.00, -0.10, 0.50])),
    Anchor.FOREHEAD:      ("Head",   np.array([0.00, 0.16, 0.40])),
    Anchor.CHIN:          ("Head",   np.array([0.00, -0.35, 0.35])),   # closer to face
    Anchor.NEUTRAL_SPACE: ("Spine2", np.array([0.20, 0.10, 0.65])),    # in front but not far
    Anchor.SHOULDER:      ("Spine2", np.array([-0.40, 0.05, 0.45])),
}
# OTHER_HAND: non-dominant 'anvil' base, and the dominant hand's offset from it.
_NDOM_BASE = ("Spine1", np.array([0.0, 0.02, 0.45]))   # lower fist at the chest surface
_FOREARM_FWD = 0.0

# default 3D linear stroke direction per anchor (body frame), kept near the anchor band
_LINEAR_DIR = {
    Anchor.CHIN:          np.array([0.0, -0.6, 0.7]),
    Anchor.FOREHEAD:      np.array([1.0, 0.0, 0.0]),
    Anchor.CHEST:         np.array([1.0, 0.0, 0.0]),
    Anchor.BELLY:         np.array([1.0, 0.0, 0.0]),
    Anchor.SHOULDER:      np.array([1.0, -0.2, 0.0]),
    Anchor.NEUTRAL_SPACE: np.array([0.0, -0.3, -1.0]),   # pull in toward the body
    Anchor.OTHER_HAND:    np.array([0.0, 1.0, 0.0]),     # rise (HELP)
}


def _dom_offset(sign: Sign) -> np.ndarray:
    loc = sign.location
    # A real vertical stack (one fist clearly above the other) needs a gap bigger than a fist so the
    # curled fingers of the two hands don't interpenetrate; slight forward bias keeps the top fist
    # in front of the bottom one too.
    if loc.vertical == "above":
        return np.array([0.0, 0.26, 0.04])           # x-aligned, grinding fist directly above
    if loc.vertical == "below":
        return np.array([0.0, -0.26, 0.04])
    return np.array([0.30, 0.05, 0.04])           # hands side by side


# Per-sign palm facing in the body frame (x=right, y=up, z=forward/toward viewer). None = leave the
# hand at its natural IK orientation (fists, where palm facing reads fine either way).
_PALM_FACE = {
    "PLEASE": [0.0, 0.0, -1.0],      # flat hand palm-in on the chest
    "THANK_YOU": [0.0, 0.0, -1.0],   # flat hand palm-in at the chin
    "WANT": [0.0, 1.0, 0.0],         # open hands palm-up, pulling in
    "COFFEE": [0.0, -1.0, 0.0],      # dominant (top) fist palm-DOWN, grinding on top
    "YES": None,                     # fist — natural orientation
}
# Non-dominant palm facing, where it differs from the dominant hand (two-handed asymmetric signs).
_PALM_FACE_N = {
    "COFFEE": [0.0, 1.0, 0.0],       # non-dominant (bottom) anvil fist palm-UP; both fists curl inward
}
_PALM_DEFAULT = [0.0, 0.0, 1.0]      # most signs: palm out toward the viewer (fingerspelling, pointing)

# Extra per-finger splay (radians) on top of the default fingers-together adduction. The V handshape
# spreads index and middle apart; everything else stays together.
_SPREAD = {
    "v": [0.45, -0.20, 0.0, 0.0],      # wider V spread so index + middle don't overlap
    "y": [0.0, 0.0, 0.0, -0.40],        # splay pinky outward away from ring
}


# Graduated thumb for the AVATAR only (0=folded, 0.5=alongside, 1=extended). SHAPE_SPECS keeps a
# boolean thumb for the recognition round-trip; this table refines it for rendering where a partial
# thumb reads better (A rests alongside the fist; B tucks across the palm).
_AVATAR_THUMB = {"a": 0.5, "b": 0.3}


def _shape(req) -> dict:
    kind = req.kind.lower()
    ext, thumb = SHAPE_SPECS[kind]
    thumb_val = _AVATAR_THUMB.get(kind, 1.0 if thumb else 0.0)
    out = {"kind": req.kind, "ext": list(ext), "thumb": float(thumb_val)}
    if kind in _SPREAD:
        out["spread"] = _SPREAD[kind]
    return out


def _frame_count(sign: Sign, fps: float) -> tuple[int, float]:
    mv = sign.movement
    duration = 1.0 if mv.kind == MovementKind.NONE else max(1.4, mv.min_duration_s + 0.7)
    return max(int(round(fps * duration)) + 1, 12), duration


# Per-sign position overrides (dom_base, ndom_base, anchor_joint).
# These take priority over the generic anchor lookup when the sign needs a specific arm geometry.
_SIGN_POS = {
    "WANT": {
        "anchor": "Spine1",
        "dom":  np.array([0.30, -0.20, 0.55]),    # belly height, elbows bent ~90deg, palms up
        "ndom": np.array([-0.30, -0.20, 0.55]),
    },
}


def _plan(sign: Sign, n: int):
    """Per-frame (dom_off[n,3], ndom_off[n,3] | None) body-frame target offsets."""
    mv = sign.movement
    other = sign.location.anchor == Anchor.OTHER_HAND

    # Sign-specific position override
    if sign.name in _SIGN_POS:
        sp = _SIGN_POS[sign.name]
        dom_base = sp["dom"].astype(float)
        ndom_base = sp["ndom"].astype(float) if "ndom" in sp else None
    elif other:
        _, base = _NDOM_BASE
        ndom_base = base.astype(float)
        dom_base = ndom_base + _dom_offset(sign)
    else:
        _, base = _ANCHOR_BASE.get(sign.location.anchor, _ANCHOR_BASE[Anchor.NEUTRAL_SPACE])
        dom_base = base.astype(float)
        ndom_base = dom_base + np.array([-0.34, 0.0, 0.0]) if sign.two_handed else None

    if mv.kind == MovementKind.NONE:
        dom = np.tile(dom_base, (n, 1))
        ndom = np.tile(ndom_base, (n, 1)) if ndom_base is not None else None
        return dom, ndom

    if mv.kind == MovementKind.LINEAR:
        d = _LINEAR_DIR.get(sign.location.anchor, np.array([1.0, 0.0, 0.0])).astype(float)
        d = d / (np.linalg.norm(d) or 1.0)
        amp = max(mv.min_displacement_ratio * 1.3, 0.32)
        dom = tj.linear_path(dom_base - 0.5 * amp * d, dom_base + 0.5 * amp * d, n)
        if other and ndom_base is not None:
            ndom = ndom_base + (dom - dom[0])           # platform rises with the hand (HELP)
        elif sign.two_handed:
            ndom = ndom_base + (dom - dom[0])           # both stroke together (WANT)
        else:
            ndom = None
        return dom, ndom

    if mv.kind == MovementKind.CIRCULAR:
        total = np.radians(max(mv.min_total_rotation_deg + 60.0, 400.0))
        # Two-handed grind (COFFEE): horizontal circle parallel to the ground (normal = up). A
        # one-handed circle on a body surface (PLEASE on the chest) stays in the frontal plane.
        normal = (0, 1, 0) if other else (0, 0, 1)
        radius = 0.11 if other else 0.12
        dom = tj.circular_path_3d(dom_base, radius, total, n, normal=normal, start_angle=-np.pi / 2)
        ndom = np.tile(ndom_base, (n, 1)) if ndom_base is not None else None
        return dom, ndom

    if mv.kind == MovementKind.REPEATED:
        amp, cycles = 0.11, mv.min_cycles + 0.7
        dom = tj.oscillation_path(dom_base, (0, 1, 0), amp, cycles, n)
        if other and ndom_base is not None:
            ndom = np.tile(ndom_base, (n, 1))
        elif sign.two_handed:
            ndom = tj.oscillation_path(ndom_base, (0, 1, 0), amp, cycles, n)
        else:
            ndom = None
        return dom, ndom

    if mv.kind == MovementKind.CONVERGE:
        center = _ANCHOR_BASE[Anchor.NEUTRAL_SPACE][1].astype(float)
        sa, sb = center + np.array([0.30, 0, 0]), center + np.array([-0.30, 0, 0])
        dom, ndom = tj.converge_paths(sa, sb, n, gap_close_frac=0.6)
        return dom, ndom

    dom = np.tile(dom_base, (n, 1))
    return dom, (np.tile(ndom_base, (n, 1)) if ndom_base is not None else None)


def build_animation(sign: Sign, fps: float = 30.0) -> dict:
    """Compile a Sign into a JSON-able 3D avatar animation track."""
    n, duration = _frame_count(sign, fps)
    dom_off, ndom_off = _plan(sign, n)

    if sign.name in _SIGN_POS:
        anchor_joint = _SIGN_POS[sign.name].get("anchor", "Spine2")
    elif sign.location.anchor == Anchor.OTHER_HAND:
        anchor_joint = _NDOM_BASE[0]
    else:
        anchor_joint = _ANCHOR_BASE.get(sign.location.anchor, _ANCHOR_BASE[Anchor.NEUTRAL_SPACE])[0]

    frames = []
    for i in range(n):
        f = {"dom": [round(float(v), 4) for v in dom_off[i]]}
        if ndom_off is not None:
            f["ndom"] = [round(float(v), 4) for v in ndom_off[i]]
        frames.append(f)

    out = {
        "name": sign.name,
        "fps": fps,
        "duration": round(duration, 3),
        "two_handed": bool(sign.two_handed and ndom_off is not None),
        "anchorJoint": anchor_joint,
        "dom": _shape(sign.dominant),
        "ndom": _shape(sign.nondominant) if (sign.two_handed and ndom_off is not None and sign.nondominant) else None,
        "palmFace": _PALM_FACE.get(sign.name, _PALM_DEFAULT),
        "palmFaceN": _PALM_FACE_N.get(sign.name),
        "frames": frames,
    }
    return out
