"""C.2.5 — Dataset inspector: the GATE before any training.

Catches the silent killers (missing hands, swapped handedness, upside-down / mirrored
coordinates, dead frames) BEFORE a training run wastes hours. Two outputs:

  1. Health report (text) from the C.1 manifest: per-sign hand coverage, zero-hand frames,
     handedness balance, suspiciously short clips. Flags anything that looks wrong.

  2. Stick-figure sprite sheets rendered FROM THE CACHED, NORMALIZED FEATURES the model will
     actually train on — not the raw landmarks. So if normalization flipped Y or dropped a
     hand, you SEE it. One PNG per sign under ml/inspect_out/.

    python -m ml.inspect --cache data/cache.npz --manifest data/manifest.csv

Do not proceed to training until a sample of each sign visually reads as the correct sign
(right handedness, upright, hands present).
"""
from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path

import numpy as np

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt  # noqa: E402

# Mirror ml/dataset.py feature layout.
N_LANDMARKS = 21
PER_HAND = N_LANDMARKS * 2
PER_HAND_F = PER_HAND + 1
# Slot 0/1 = Dominant/Nondominant (mirrors ml/dataset.py's assign_roles() re-slotting) — NOT raw
# MediaPipe Right/Left handedness, which can land in either slot depending on which hand a given
# signer favors.
ROLE_SLOTS = ("Dominant", "Nondominant")
SLOT_COLOR = {"Dominant": "#7B2FBE", "Nondominant": "#F59E0B"}

# MediaPipe 21-point hand skeleton.
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),         # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),         # index
    (5, 9), (9, 10), (10, 11), (11, 12),    # middle
    (9, 13), (13, 14), (14, 15), (15, 16),  # ring
    (13, 17), (17, 18), (18, 19), (19, 20), # pinky
    (0, 17),                                 # palm base
]

COVERAGE_FLAG = 0.5
MIN_FRAMES = 15


# ----------------------------------------------------------------- health report

def health_report(manifest: Path) -> None:
    if not manifest.exists():
        print(f"(no manifest at {manifest} — skipping health report)")
        return
    by_sign: dict[str, list[dict]] = defaultdict(list)
    with open(manifest, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            by_sign[r["sign"]].append(r)

    print("\n=== HEALTH REPORT (from manifest) ===")
    print(f"{'sign':<12}{'clips':>6}{'avg_cov':>9}{'min_cov':>9}{'L/R obs':>12}  flags")
    any_flag = False
    for sign in sorted(by_sign):
        rows = by_sign[sign]
        covs = [float(r["hand_coverage"]) for r in rows]
        nframes = [int(r["n_frames"]) for r in rows]
        lobs = sum(int(r["left_obs"]) for r in rows)
        robs = sum(int(r["right_obs"]) for r in rows)
        flags = []
        if min(covs) < COVERAGE_FLAG:
            flags.append("LOW_COVERAGE")
        if min(nframes) < MIN_FRAMES:
            flags.append("SHORT_CLIP")
        if lobs == 0 or robs == 0:
            flags.append("ONE_HANDED?")  # fine for 1-handed signs, suspect for 2-handed
        if flags:
            any_flag = True
        print(f"{sign:<12}{len(rows):>6}{np.mean(covs):>9.2f}{min(covs):>9.2f}"
              f"{(str(lobs) + '/' + str(robs)):>12}  {' '.join(flags)}")
    if not any_flag:
        print("no flags — coverage and lengths look healthy")


# ----------------------------------------------------------------- visual gate

def _hand_from_vec(vec: np.ndarray, slot: int):
    """Return (21,2) points + present-bool for one hand slot, from an 86-dim frame vec."""
    base = slot * PER_HAND_F
    pts = vec[base:base + PER_HAND].reshape(N_LANDMARKS, 2)
    present = vec[base + PER_HAND] > 0.5
    return pts, present


def render_sign(seq: np.ndarray, sign: str, out_dir: Path, n_cols: int = 8) -> None:
    """Render a row of stick-figure keyframes from the NORMALIZED feature sequence."""
    T = seq.shape[0]
    idxs = np.linspace(0, T - 1, num=min(n_cols, T)).astype(int)
    fig, axes = plt.subplots(1, len(idxs), figsize=(2.0 * len(idxs), 2.4))
    if len(idxs) == 1:
        axes = [axes]

    for ax, t in zip(axes, idxs):
        vec = seq[t]
        drew = False
        for slot, role in enumerate(ROLE_SLOTS):
            pts, present = _hand_from_vec(vec, slot)
            if not present:
                continue
            drew = True
            color = SLOT_COLOR[role]
            for a, b in HAND_CONNECTIONS:
                ax.plot([pts[a, 0], pts[b, 0]], [pts[a, 1], pts[b, 1]],
                        color=color, linewidth=1.2)
            ax.scatter(pts[:, 0], pts[:, 1], s=6, color=color)
        ax.set_title(f"f{t}", fontsize=7)
        ax.set_xlim(-2.0, 2.0)
        ax.set_ylim(-2.0, 2.0)
        ax.invert_yaxis()  # image y is downward; upright here = upright in the webcam
        ax.set_aspect("equal")
        ax.axis("off")
        if not drew:
            ax.text(0, 0, "no hands", ha="center", va="center", fontsize=7, color="red")

    fig.suptitle(f"{sign}   (purple=Right  amber=Left)", fontsize=10)
    fig.tight_layout()
    out = out_dir / f"{sign}.png"
    fig.savefig(out, dpi=90)
    plt.close(fig)


def visual_gate(cache: Path, out_dir: Path, per_class: int = 1) -> None:
    data = np.load(cache, allow_pickle=True)
    X, y, classes = data["X"], data["y"], data["classes"]
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== VISUAL GATE -> {out_dir} ===")
    for ci, cls in enumerate(classes):
        members = np.where(y == ci)[0]
        for k, idx in enumerate(members[:per_class]):
            name = str(cls) if per_class == 1 else f"{cls}_{k}"
            render_sign(X[idx], name, out_dir)
    print(f"rendered {len(classes)} sign(s). Open the PNGs and confirm each reads correctly:")
    print("  - hands UPRIGHT (not upside down)")
    print("  - correct handedness colors (purple=Right, amber=Left)")
    print("  - hands present through the motion (no 'no hands' frames mid-sign)")


def main() -> None:
    p = argparse.ArgumentParser(description="Inspect the training cache before training (gate).")
    p.add_argument("--cache", default="data/cache.npz")
    p.add_argument("--manifest", default="data/manifest.csv")
    p.add_argument("--out", default="ml/inspect_out")
    p.add_argument("--per-class", type=int, default=1)
    args = p.parse_args()

    health_report(Path(args.manifest))
    visual_gate(Path(args.cache), Path(args.out), args.per_class)


if __name__ == "__main__":
    main()
