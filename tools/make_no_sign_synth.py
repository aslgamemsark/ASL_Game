"""Generate synthetic NO_SIGN training clips: chaotic, non-periodic hand motion that isn't any
real sign — the negative class a closed-set classifier can't otherwise learn to reject.

Unlike make_synth_fixtures.py's oscillation generator (clean sinusoidal motion for confusor
tests), this produces genuinely chaotic random-walk trajectories: varied speed, varied direction
changed at random intervals (not a fixed frequency), varied location, random handshape that
doesn't track any defined sign pattern, and a random mix of one/two hands. This is the "user is
waving their arm around like a mad person" case from production reports — no amount of clean
sinusoidal data teaches a model to reject that, since real chaotic motion has no fixed period to
contrast against.

    python -m tools.make_no_sign_synth --count 300 --out data/synth_no_sign/landmarks

Deterministic (seeded) so regenerating produces the same clips — same convention as
make_synth_fixtures.py's idle jitter.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from core.landmarks import Frame, Hand, WRIST, THUMB_TIP, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP

W, H = 640, 480
CX = 320.0
SY = 120.0
SW = 240.0
LS = np.array([CX - SW / 2, SY])
RS = np.array([CX + SW / 2, SY])
MOUTH = np.array([CX, SY - 0.45 * SW])
D = 70.0

_MCPS = [INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP]
_TIPS = [8, 12, 16, 20]  # INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP
_X_OFF = [-0.27, -0.09, 0.09, 0.27]
UP = np.array([0.0, -1.0])
_SEG = {(INDEX_MCP, 8): (6, 7), (MIDDLE_MCP, 12): (10, 11), (RING_MCP, 16): (14, 15), (PINKY_MCP, 20): (18, 19)}


def _random_hand(handedness: str, center, ratios, thumb_out: bool) -> Hand:
    """Build a 21-landmark hand with ARBITRARY (not sign-matching) per-finger curl ratios."""
    center = np.asarray(center, float)
    c = center + np.array([0.0, 0.3 * D])
    pts = np.zeros((21, 3))
    wrist = c + np.array([0.0, 0.5 * D])
    pts[WRIST, :2] = wrist

    for k in range(4):
        mcp = wrist + UP * D + np.array([_X_OFF[k] * D, 0.0])
        v = mcp - wrist
        u = v / (np.linalg.norm(v) + 1e-9)
        tip = wrist + u * (ratios[k] * np.linalg.norm(v))
        pts[_MCPS[k], :2] = mcp
        pts[_TIPS[k], :2] = tip

    if thumb_out:
        pts[THUMB_TIP, :2] = wrist + UP * (0.2 * D) + np.array([-1.05 * D, 0.0])
    else:
        pts[THUMB_TIP, :2] = pts[INDEX_MCP, :2] + np.array([-0.15 * D, 0.10 * D])

    for j, frac in ((1, 0.25), (2, 0.5), (3, 0.75)):
        pts[j, :2] = wrist * (1 - frac) + pts[THUMB_TIP, :2] * frac
    for (mcp, tip), (a, b) in _SEG.items():
        pts[a, :2] = pts[mcp, :2] * 0.66 + pts[tip, :2] * 0.34
        pts[b, :2] = pts[mcp, :2] * 0.33 + pts[tip, :2] * 0.67
    return Hand(handedness=handedness, points=pts)


def _chaotic_walk(rng: np.random.Generator, n: int, start) -> list[np.ndarray]:
    """Random-walk trajectory: velocity changes direction/speed at random, uneven intervals —
    NOT a fixed-frequency oscillation. This is what makes it distinct from the REPEATED/LINEAR
    confusors already covered by the rule-verifier fixtures: no consistent period or axis at all.
    """
    pos = np.asarray(start, float).copy()
    pts = [pos.copy()]
    vel = rng.normal(0, 40, size=2)
    steps_to_next_change = 0
    for _ in range(n - 1):
        if steps_to_next_change <= 0:
            vel = rng.normal(0, rng.uniform(20, 90), size=2)
            steps_to_next_change = rng.integers(2, 10)
        pos = pos + vel * (1.0 / 30.0)
        # Keep roughly on-screen / near the body.
        pos[0] = np.clip(pos[0], CX - 1.3 * SW, CX + 1.3 * SW)
        pos[1] = np.clip(pos[1], SY - 0.6 * SW, SY + 1.6 * SW)
        pts.append(pos.copy())
        steps_to_next_change -= 1
    return pts


def make_clip(rng: np.random.Generator) -> dict:
    duration = rng.uniform(1.5, 2.5)
    n = max(10, int(duration * 30))
    two_hands = rng.random() < 0.5

    def rand_ratios():
        # Uniform random per-finger extension — deliberately NOT matching any _RATIOS pattern
        # in make_synth_fixtures.py (no fixed handshape family), re-rolled per clip.
        return rng.uniform(1.0, 1.6, size=4)

    dom_start = [CX + rng.uniform(-1.0, 1.0) * SW, SY + rng.uniform(0.1, 1.0) * SW]
    dom_traj = _chaotic_walk(rng, n, dom_start)
    dom_ratios = rand_ratios()
    dom_thumb_out = rng.random() < 0.3

    ndom_traj = None
    if two_hands:
        ndom_start = [CX + rng.uniform(-1.0, 1.0) * SW, SY + rng.uniform(0.1, 1.0) * SW]
        ndom_traj = _chaotic_walk(rng, n, ndom_start)
        ndom_ratios = rand_ratios()
        ndom_thumb_out = rng.random() < 0.3

    frames = []
    for i in range(n):
        t = i * (duration / (n - 1))
        hands = [_random_hand("Right", dom_traj[i], dom_ratios, dom_thumb_out)]
        if two_hands:
            hands.append(_random_hand("Left", ndom_traj[i], ndom_ratios, ndom_thumb_out))
        frames.append(Frame(t=t, width=W, height=H, hands=hands,
                             left_shoulder=LS.copy(), right_shoulder=RS.copy(), mouth=MOUTH.copy()))

    return {"sign_name": "NO_SIGN", "synthetic": True,
            "frames": [f.to_dict() for f in frames]}


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate synthetic chaotic-motion NO_SIGN clips.")
    ap.add_argument("--count", type=int, default=300)
    ap.add_argument("--out", default="data/synth_no_sign/landmarks")
    ap.add_argument("--seed", type=int, default=20260714)
    args = ap.parse_args()

    out_dir = Path(args.out) / "NO_SIGN"
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(args.seed)

    for i in range(args.count):
        clip = make_clip(rng)
        (out_dir / f"no_sign_{i:04d}.json").write_text(json.dumps(clip), encoding="utf-8")

    print(f"wrote {args.count} synthetic NO_SIGN clips -> {out_dir}")


if __name__ == "__main__":
    main()
