"""Hand-authored keyframe animation for the 12 coffee-shop signs.

This bypasses noisy monocular capture entirely. Each sign is authored BY HAND as a few keyframes
(start -> key -> end) giving the dominant/non-dominant hand POSITION (body frame), HANDSHAPE, and
PALM facing. We interpolate the positions into per-frame tracks and emit the SAME anim JSON the
avatar viewer already plays (anim/<SIGN>.json) — so no avatar changes are needed.

Body frame (shoulder-width units, relative to one anchor bone): x = signer's right, y = up,
z = forward (toward camera). Dominant hand = Right.

    python -m tools.author_signs            # write all 12
    python -m tools.author_signs COFFEE     # just one
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from core.handshape_presets import SHAPE_SPECS

OUT_DIR = Path("D:/asl-synthesis/anim")
FPS = 30.0

# per-finger extra splay (radians) for shapes that spread; matches avatar setHand `spread`
_SPREAD = {"v": [0.45, -0.20, 0.0, 0.0], "y": [0.0, 0.0, 0.0, -0.40]}
# graduated avatar thumb (0 folded .. 1 extended); others derive from the boolean preset
_THUMB = {"a": 0.5, "b": 0.3}


def _shape(kind: str) -> dict:
    k = kind.lower()
    ext, thumb_bool = SHAPE_SPECS[k]
    out = {"kind": kind, "ext": list(ext), "thumb": _THUMB.get(k, 1.0 if thumb_bool else 0.0)}
    if k in _SPREAD:
        out["spread"] = _SPREAD[k]
    return out


def _smoothstep(a, b, n):
    """n positions eased from a->b (smoothstep) so motion accelerates/decelerates, less robotic."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    ts = np.linspace(0, 1, n)
    es = ts * ts * (3 - 2 * ts)
    return [a + (b - a) * e for e in es]


def _circle(center, radius, plane, n, turns=2.0, start=-np.pi / 2):
    """n positions tracing `turns` circles of `radius` in a plane ('xy','xz','yz') around center."""
    c = np.asarray(center, float)
    out = []
    for i in range(n):
        ang = start + 2 * np.pi * turns * (i / max(n - 1, 1))
        if plane == "xz":   # horizontal grind (COFFEE): vary x,z keep y
            d = np.array([np.cos(ang), 0.0, np.sin(ang)])
        elif plane == "yz":
            d = np.array([0.0, np.cos(ang), np.sin(ang)])
        else:               # 'xy' frontal circle (PLEASE on chest)
            d = np.array([np.cos(ang), np.sin(ang), 0.0])
        out.append(c + radius * d)
    return out


def _interp(keys, n):
    """keys = list of (t01, [x,y,z]); return n eased positions across the path."""
    if len(keys) == 1:
        return [np.asarray(keys[0][1], float)] * n
    segs = []
    for i in range(len(keys) - 1):
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        cnt = max(2, int(round((t1 - t0) * n)))
        segs.append((p0, p1, cnt))
    out = []
    for p0, p1, cnt in segs:
        pts = _smoothstep(p0, p1, cnt)
        out.extend(pts if not out else pts[1:])
    while len(out) < n:
        out.append(out[-1])
    return out[:n]


# ---- THE SIGNS (hand-authored) ------------------------------------------------------------------
# Each: anchor bone, dominant/non-dominant handshape, palm-facing vectors, duration, and the motion
# (either "keys" position list, or a generated circle/oscillation). Two-handed signs give ndom too.
def _frames_static(pos, n):
    return [np.asarray(pos, float)] * n


SIGNS: dict[str, dict] = {
    # --- fingerspelling: hand held UP by the dominant shoulder/chin, forearm vertical (fingers up),
    #     palm to the viewer, static. High y keeps the hand above the elbow so the fingers point up. ---
    "LETTER_A": dict(anchor="Spine2", dom="a", palm=[0, 0, 1], dur=1.2,
                     dom_path=[(0.0, [0.42, 0.60, 0.45])]),
    "LETTER_B": dict(anchor="Spine2", dom="b", palm=[0, 0, 1], dur=1.2,
                     dom_path=[(0.0, [0.42, 0.60, 0.45])]),
    "LETTER_L": dict(anchor="Spine2", dom="l", palm=[0, 0, 1], dur=1.2,
                     dom_path=[(0.0, [0.42, 0.60, 0.45])]),
    "LETTER_V": dict(anchor="Spine2", dom="v", palm=[0, 0, 1], dur=1.2,
                     dom_path=[(0.0, [0.42, 0.60, 0.45])]),
    "LETTER_Y": dict(anchor="Spine2", dom="y", palm=[0, 0, 1], dur=1.2,
                     dom_path=[(0.0, [0.42, 0.60, 0.45])]),
    # --- YOU: index points toward the viewer, arm extended forward ---
    "YOU": dict(anchor="Spine2", dom="1", palm=[0, -0.3, 1], dur=1.2,
                dom_path=[(0.0, [0.12, 0.12, 0.95])]),
    # --- YES: S-fist 'nods' (knuckles forward) — faked as a small down/up bob of the fist ---
    "YES": dict(anchor="Spine2", dom="s", palm=[0, 0, 1], dur=1.6,
                dom_path=[(0.0, [0.25, 0.18, 0.7]), (0.3, [0.25, 0.05, 0.72]),
                          (0.6, [0.25, 0.18, 0.7]), (1.0, [0.25, 0.05, 0.72])]),
    # --- HELLO: flat hand salute from the temple, swinging outward ---
    "HELLO": dict(anchor="Head", dom="b", palm=[0, 0.2, 1], dur=1.4,
                  dom_path=[(0.0, [0.28, 0.18, 0.45]), (1.0, [0.62, 0.12, 0.55])]),
    # --- THANK_YOU: flat hand, fingertips at the chin, move forward and down toward the person ---
    "THANK_YOU": dict(anchor="Head", dom="b", palm=[0, 0.7, 0.7], dur=1.4,
                      dom_path=[(0.0, [0.05, -0.35, 0.33]), (1.0, [0.12, -0.85, 0.62])]),
    # --- PLEASE: flat hand flat on the chest, circular rub (frontal plane) ---
    "PLEASE": dict(anchor="Spine1", dom="b", palm=[0, 0, -1], dur=1.8,
                   dom_circle=dict(center=[0.0, 0.05, 0.40], radius=0.12, plane="xy", turns=2.0)),
    # --- WANT: both open 'claw' hands, palms up, pull in toward the body ---
    "WANT": dict(anchor="Spine1", dom="claw", ndom="claw", palm=[0, 1, 0.2], palm_n=[0, 1, 0.2],
                 dur=1.4, two_handed=True,
                 dom_path=[(0.0, [0.30, -0.12, 0.78]), (1.0, [0.30, -0.12, 0.48])],
                 ndom_path=[(0.0, [-0.30, -0.12, 0.78]), (1.0, [-0.30, -0.12, 0.48])]),
    # --- COFFEE: non-dominant S-fist still ('anvil'); dominant S-fist circles on top of it ---
    "COFFEE": dict(anchor="Spine1", dom="s", ndom="s", palm=[0, -1, 0], palm_n=[0, 1, 0],
                   dur=1.8, two_handed=True,
                   dom_circle=dict(center=[0.0, 0.16, 0.5], radius=0.10, plane="xz", turns=2.0),
                   ndom_path=[(0.0, [0.0, -0.04, 0.5])]),
}


def build(name: str) -> dict:
    s = SIGNS[name]
    dur = s.get("dur", 1.4)
    n = max(int(round(FPS * dur)) + 1, 12)
    two = s.get("two_handed", False)

    if "dom_circle" in s:
        c = s["dom_circle"]
        dom = _circle(c["center"], c["radius"], c["plane"], n, c.get("turns", 2.0))
    else:
        dom = _interp(s["dom_path"], n)

    ndom = None
    if two or "ndom_path" in s:
        if "ndom_circle" in s:
            c = s["ndom_circle"]
            ndom = _circle(c["center"], c["radius"], c["plane"], n, c.get("turns", 2.0))
        else:
            ndom = _interp(s["ndom_path"], n)

    frames = []
    for i in range(n):
        f = {"dom": [round(float(v), 4) for v in dom[i]]}
        if ndom is not None:
            f["ndom"] = [round(float(v), 4) for v in ndom[i]]
        frames.append(f)

    out = {
        "name": name, "fps": FPS, "duration": round(dur, 3),
        "two_handed": bool(two and ndom is not None),
        "anchorJoint": s["anchor"],
        "dom": _shape(s["dom"]),
        "ndom": _shape(s["ndom"]) if s.get("ndom") else None,
        "palmFace": s.get("palm"),
        "palmFaceN": s.get("palm_n"),
        "frames": frames,
    }
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Author keyframe anims for the avatar viewer.")
    ap.add_argument("signs", nargs="*", help="default: all")
    args = ap.parse_args(argv)
    names = [s.upper() for s in args.signs] or list(SIGNS.keys())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in names:
        anim = build(name)
        (OUT_DIR / f"{name}.json").write_text(json.dumps(anim), encoding="utf-8")
        print(f"authored {name}: {len(anim['frames'])} frames ({anim['duration']}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
