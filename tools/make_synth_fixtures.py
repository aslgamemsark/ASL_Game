"""Generate deterministic synthetic landmark fixtures for the confusor regression tests.

These are NOT webcam recordings — they are geometrically constructed landmark clips, so the test
suite is reproducible in CI (no camera) and exercises the verifier's gating precisely:

  - <name>_correct.json  performs the real motion and clears every required parameter.
  - <name>_confusor.json freezes the SAME handshape with NO motion, so it fails on the MOVEMENT
    parameter specifically (the anti-bug guarantee).

Hands are built by placing the 21 landmarks the classifiers actually read (wrist, finger MCPs and
tips, thumb tip) to hit a target handshape, then translating/oscillating the whole hand over time
to create the motion. Distances are in pixels against a fixed synthetic shoulder width.

To replace any fixture with a REAL recording (preferred for dataset-building), just record over
the same filename with the now-fixed recorder:
    python -m tools.record_fixture --name help_correct --seconds 4 --sign HELP

Regenerate all synthetic fixtures:
    python -m tools.make_synth_fixtures
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from core.landmarks import (
    Frame, Hand,
    WRIST, THUMB_TIP,
    INDEX_MCP, INDEX_TIP, MIDDLE_MCP, MIDDLE_TIP,
    RING_MCP, RING_TIP, PINKY_MCP, PINKY_TIP,
)

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures"

# --- synthetic frame geometry (pixels) ---
W, H = 640, 480
CX = 320.0
SY = 120.0
SW = 240.0                      # shoulder width in px
LS = np.array([CX - SW / 2, SY])
RS = np.array([CX + SW / 2, SY])
MOUTH = np.array([CX, SY - 0.45 * SW])   # face landmark (above shoulders) for chin/forehead signs
N = 60                          # frames per clip
T = 2.0                         # seconds per clip
D = 70.0                        # within-hand scale (wrist -> MCP) in px

# Vertical targets (palm-center y) that land a hand in each body-anchor band:
Y_FOREHEAD = MOUTH[1] - 0.20 * SW         # up at the face (above the mouth)
Y_CHIN = MOUTH[1] + 0.45 * SW             # at the chin (palm below the mouth)
Y_CHEST = SY + 0.35 * SW                  # on the chest
Y_BELLY = SY + 0.90 * SW                  # low on the torso

UP = np.array([0.0, -1.0])
_MCPS = [INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP]
_TIPS = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
_X_OFF = [-0.27, -0.09, 0.09, 0.27]            # index..pinky horizontal MCP offsets (x D)

# tip/MCP distance ratio per finger that core.handshape._finger_curl maps to a curl:
#   ratio 1.6 -> curl 0 (extended);  ratio 1.0 -> curl 1 (curled);  ratio 1.3 -> curl ~0.5 (claw)
_RATIOS = {
    "open":   [1.6, 1.6, 1.6, 1.6],
    "fist":   [1.0, 1.0, 1.0, 1.0],
    "a":      [1.0, 1.0, 1.0, 1.0],
    "index":  [1.6, 1.0, 1.0, 1.0],
    "point":  [1.6, 1.0, 1.0, 1.0],   # alias of index — LETTER_A/1-point family
    "claw":   [1.3, 1.3, 1.3, 1.3],
    "n":      [1.6, 1.6, 1.0, 1.0],   # 2 fingers (index+middle)
    "h":      [1.6, 1.6, 1.0, 1.0],   # same as n
    "v":      [1.6, 1.6, 1.0, 1.0],   # same as n/h — see core/handshape.py's _PATTERNS note
    "w":      [1.6, 1.6, 1.6, 1.0],   # 3 fingers (index+middle+ring)
    "middle": [1.0, 1.6, 1.0, 1.0],   # middle only
    "y":      [1.0, 1.0, 1.0, 1.6],   # pinky only extended + thumb OUT — LETTER_Y
    "i":      [1.0, 1.0, 1.0, 1.6],   # pinky only extended, thumb CURLED — LETTER_I (see thumb table)
    "l":      [1.6, 1.0, 1.0, 1.0],   # index only extended + thumb OUT — LETTER_L
}

# Shapes whose thumb sticks OUT alongside the hand (make_hand's default is tucked-against-index,
# correct for fist/index/claw/etc; "a"/"y"/"l" all specifically require an extended thumb, and an
# "i" built with the SAME tucked thumb as e.g. "index" is exactly the confusor we need — a real
# thumb-out Y-hand must NOT satisfy "i" (see core/handshape.py's "thumb=0 required for i" note).
_THUMB_OUT_SHAPES = {"a", "y", "l"}

# fill (unused-by-scorers) joints so each hand is a plausible 21-point array
_SEG = {(INDEX_MCP, INDEX_TIP): (6, 7), (MIDDLE_MCP, MIDDLE_TIP): (10, 11),
        (RING_MCP, RING_TIP): (14, 15), (PINKY_MCP, PINKY_TIP): (18, 19)}


def make_hand(handedness: str, center_target, shape: str) -> Hand:
    """Build a 21-landmark hand whose palm-center sits at `center_target`, forming `shape`."""
    center_target = np.asarray(center_target, float)
    # hand.center = c + (0, -0.3D) for this layout, so offset c to land center on target.
    c = center_target + np.array([0.0, 0.3 * D])
    pts = np.zeros((21, 3))
    wrist = c + np.array([0.0, 0.5 * D])
    pts[WRIST, :2] = wrist

    ratios = _RATIOS[shape]
    for k in range(4):
        mcp = wrist + UP * D + np.array([_X_OFF[k] * D, 0.0])
        v = mcp - wrist
        u = v / (np.linalg.norm(v) + 1e-9)
        tip = wrist + u * (ratios[k] * np.linalg.norm(v))
        pts[_MCPS[k], :2] = mcp
        pts[_TIPS[k], :2] = tip

    # thumb: extended alongside for "a"/"y"/"l", tucked near the index MCP otherwise
    if shape in _THUMB_OUT_SHAPES:
        pts[THUMB_TIP, :2] = wrist + UP * (0.2 * D) + np.array([-1.05 * D, 0.0])
    else:
        pts[THUMB_TIP, :2] = pts[INDEX_MCP, :2] + np.array([-0.15 * D, 0.10 * D])

    # plausible filler joints (thumb 1-3 and finger PIP/DIP) — not read by the classifiers
    for j, frac in ((1, 0.25), (2, 0.5), (3, 0.75)):
        pts[j, :2] = wrist * (1 - frac) + pts[THUMB_TIP, :2] * frac
    for (mcp, tip), (a, b) in _SEG.items():
        pts[a, :2] = pts[mcp, :2] * 0.66 + pts[tip, :2] * 0.34
        pts[b, :2] = pts[mcp, :2] * 0.33 + pts[tip, :2] * 0.67
    return Hand(handedness=handedness, points=pts)


def _frame(t: float, hands: list[Hand]) -> Frame:
    return Frame(t=t, width=W, height=H, hands=hands,
                 left_shoulder=LS.copy(), right_shoulder=RS.copy(), mouth=MOUTH.copy())


def _write(name: str, sign_name: str, frames: list[Frame]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = {"sign_name": sign_name, "synthetic": True,
            "frames": [f.to_dict() for f in frames]}
    with open(OUT / f"{name}.json", "w") as fh:
        json.dump(data, fh)
    print(f"wrote {name}.json  ({len(frames)} frames, {frames[-1].t - frames[0].t:.1f}s)")


# --------------------------------------------------------------- per-sign clip builders
def _ts():
    return [i * (T / (N - 1)) for i in range(N)]


# Each clip is built in one of three modes:
#   "correct"  — performs the sign's real motion (must PASS)
#   "confusor" — freezes the correct handshape with NO motion (must FAIL on movement)
#   "idle"     — correct-ish handshapes held with small incidental JITTER, no sign motion: the
#                "user is present but not performing the sign" case (must FAIL on movement)
_JIT = np.random.default_rng(20260627)            # fixed seed -> reproducible idle fixtures


def _jit(scale: float = 2.0) -> np.ndarray:
    return _JIT.normal(0.0, scale, size=2)


def _progress(i: int, mode: str) -> float:
    return (i / (N - 1)) if mode == "correct" else 0.0   # confusor & idle make no sign progress


def help_clip(mode: str) -> list[Frame]:
    dom0, ndom0 = np.array([CX, 228.0]), np.array([CX, 300.0])   # fist stacked above open palm
    out = []
    for i, t in enumerate(_ts()):
        fr = _progress(i, mode)
        dom = dom0 + np.array([0.0, -70.0 * fr])                 # dominant (fist) rises a bit more...
        ndom = ndom0 + np.array([0.0, -55.0 * fr])               # ...so it's the higher-motion hand
        if mode == "idle":
            dom, ndom = dom + _jit(), ndom + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "fist"), make_hand("Left", ndom, "open")]))
    return out


def pain_clip(mode: str) -> list[Frame]:
    dom0, ndom0 = np.array([CX - 100.0, 280.0]), np.array([CX + 100.0, 280.0])
    dom1, ndom1 = np.array([CX - 30.0, 280.0]), np.array([CX + 30.0, 280.0])
    out = []
    for i, t in enumerate(_ts()):
        fr = _progress(i, mode)
        dom = dom0 + (dom1 - dom0) * fr
        ndom = ndom0 + (ndom1 - ndom0) * fr
        if mode == "idle":
            dom, ndom = dom + _jit(), ndom + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "index"), make_hand("Left", ndom, "index")]))
    return out


def medicine_clip(mode: str) -> list[Frame]:
    ndom = np.array([CX, 300.0])                                 # open palm held still
    out = []
    for t in _ts():
        dx = 25.0 * math.sin(2 * math.pi * 1.5 * t) if mode == "correct" else 0.0
        dom = np.array([CX + dx, 228.0])                         # claw rocks over the palm
        nd = ndom.copy()
        if mode == "idle":
            dom, nd = dom + _jit(), nd + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", nd, "open")]))
    return out


def emergency_clip(mode: str) -> list[Frame]:
    out = []
    for t in _ts():
        dx = 30.0 * math.sin(2 * math.pi * 2.0 * t) if mode == "correct" else 0.0
        dom = np.array([CX + dx, 220.0])                         # single claw shaken fast
        if mode == "idle":
            dom = dom + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "claw")]))
    return out


def _tap_clip(mode: str, dom_shape: str) -> list[Frame]:
    """DOCTOR / NURSE: dominant hand taps the non-dominant wrist twice (repeated).

    The wrist is held LOW (waist height) — this keeps the pose out of the chest band so it can't
    be confused with BREATHE (open hands on the chest, repeated).
    """
    ndom = np.array([CX + 50.0, Y_BELLY + 10.0])     # the wrist/forearm held low, held still
    out = []
    for t in _ts():
        dy = 25.0 * math.sin(2 * math.pi * 1.5 * t) if mode == "correct" else 0.0
        dom = np.array([CX + 50.0, Y_BELLY - 10.0 + dy])  # taps toward/away the wrist
        nd = ndom.copy()
        if mode == "idle":
            dom, nd = dom + _jit(), nd + _jit()
        out.append(_frame(t, [make_hand("Right", dom, dom_shape), make_hand("Left", nd, "open")]))
    return out


def doctor_clip(mode: str) -> list[Frame]:
    return _tap_clip(mode, "open")


def nurse_clip(mode: str) -> list[Frame]:
    return _tap_clip(mode, "n")


def fever_clip(mode: str) -> list[Frame]:
    out = []
    for i, t in enumerate(_ts()):
        fr = _progress(i, mode)
        dom = np.array([(CX - 50.0) + 100.0 * fr, Y_FOREHEAD])   # sweep across the brow
        if mode == "idle":
            dom = dom + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "open")]))
    return out


def water_clip(mode: str) -> list[Frame]:
    """WATER is a static "W reaching the chin" pose. Modes:
       correct    — W handshape at the chin              (PASS)
       wrongshape — OPEN hand at the chin                (FAIL on handshape)
       offchin    — W handshape down at the chest        (FAIL on location)
    """
    shape = "open" if mode == "wrongshape" else "w"
    y = Y_CHEST if mode == "offchin" else Y_CHIN
    return [_frame(t, [make_hand("Right", [CX, y], shape)]) for t in _ts()]


def breathe_clip(mode: str) -> list[Frame]:
    # Hands stay clearly SPREAD on the chest (never close together), so the pose can't be confused
    # with DOCTOR (one hand tapping the other).
    out = []
    for t in _ts():
        dx = 38.0 * math.sin(2 * math.pi * 1.5 * t) if mode == "correct" else 0.0
        dom = np.array([CX + 80.0 + dx, Y_CHEST])    # right hand breathes out/in (a big swing)
        nd = np.array([CX - 80.0 - dx, Y_CHEST])     # left hand mirrors
        if mode == "idle":
            dom, nd = dom + _jit(), nd + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "open"), make_hand("Left", nd, "open")]))
    return out


def hospital_clip(mode: str) -> list[Frame]:
    ndom = np.array([CX, 250.0])                     # the opposite arm, present
    out = []
    for i, t in enumerate(_ts()):
        fr = _progress(i, mode)
        dom = np.array([LS[0], 105.0 + 72.0 * fr])   # H hand draws a clear down-stroke near a shoulder
        nd = ndom.copy()
        if mode == "idle":
            dom, nd = dom + _jit(), nd + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "h"), make_hand("Left", nd, "open")]))
    return out


def dizzy_clip(mode: str) -> list[Frame]:
    cx, cy, r = CX, Y_FOREHEAD + 20.0, 32.0          # a small loop in front of the face
    out = []
    for t in _ts():
        ang = 2 * math.pi * (t / T) if mode == "correct" else 0.0
        dom = np.array([cx + r * math.cos(ang), cy + r * math.sin(ang)])
        if mode == "idle":
            dom = dom + _jit()
        out.append(_frame(t, [make_hand("Right", dom, "open")]))   # signer circles an OPEN hand
    return out


def sick_clip(mode: str) -> list[Frame]:
    """SICK is a STATIC pose, so its negatives test handshape/location (not movement):
       correct    — both middle-finger hands, dominant up at the forehead  (PASS)
       wrongshape — both OPEN hands at the same places                      (FAIL on handshape)
       lowhand    — middle hands but dominant down at the chest             (FAIL on location)
    A tiny sub-threshold wobble on the dominant hand makes it the higher-motion one, so the
    role-by-motion assignment reliably treats the forehead hand as dominant.
    """
    dom_shape = "open" if mode == "wrongshape" else "middle"
    ndom_shape = "open" if mode == "wrongshape" else "middle"
    dom_y = Y_CHEST if mode == "lowhand" else Y_FOREHEAD
    out = []
    for t in _ts():
        wob = 5.0 * math.sin(2 * math.pi * 1.0 * t)   # sub-threshold; only to fix role assignment
        dom = np.array([CX + wob, dom_y])
        nd = np.array([CX, Y_BELLY])
        out.append(_frame(t, [make_hand("Right", dom, dom_shape), make_hand("Left", nd, ndom_shape)]))
    return out


BUILDERS = {
    "help": ("HELP", help_clip),
    "pain": ("PAIN", pain_clip),
    "medicine": ("MEDICINE", medicine_clip),
    "emergency": ("EMERGENCY", emergency_clip),
    "doctor": ("DOCTOR", doctor_clip),
    "nurse": ("NURSE", nurse_clip),
    "fever": ("FEVER", fever_clip),
    "breathe": ("BREATHE", breathe_clip),
    "hospital": ("HOSPITAL", hospital_clip),
    "dizzy": ("DIZZY", dizzy_clip),
}


def main() -> None:
    # Movement signs: correct / confusor (frozen) / idle (present-but-not-signing).
    for base, (sign_name, builder) in BUILDERS.items():
        _write(f"{base}_correct", sign_name, builder("correct"))
        _write(f"{base}_confusor", sign_name, builder("confusor"))
        _write(f"{base}_idle", sign_name, builder("idle"))
    # Static signs — negatives exercise handshape and location instead of movement.
    _write("sick_correct", "SICK", sick_clip("correct"))
    _write("sick_wrongshape", "SICK", sick_clip("wrongshape"))
    _write("sick_lowhand", "SICK", sick_clip("lowhand"))
    _write("water_correct", "WATER", water_clip("correct"))
    _write("water_wrongshape", "WATER", water_clip("wrongshape"))
    _write("water_offchin", "WATER", water_clip("offchin"))


if __name__ == "__main__":
    main()
