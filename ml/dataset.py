"""C.2 — Dataset builder: Frame JSON -> cached training tensors (.npz).

JSON stays the source of truth; this converts ONCE into a compact numpy cache the trainer
reads repeatedly. Feature design mirrors the rule engine's invariances so the model learns
the sign, not the camera:

  * Per frame, each hand's 21 (x, y) landmarks are centered on the shoulder midpoint and
    scaled by shoulder width -> translation- and camera-distance-invariant (the same ratio
    trick `normalized_distance` uses in core/landmarks.py). MediaPipe z is dropped: it's a
    per-hand relative depth, not in shoulder-width units, and noisy.
  * Hands are slotted by ROLE (Dominant -> slot 0, Nondominant -> slot 1), not raw MediaPipe
    handedness — assign_roles() below picks dominant-by-motion per clip, the same heuristic
    core/verifier.py and web/src/engine/verifier.ts already use. Slotting by raw Right/Left
    handedness instead would put a left-handed signer's dominant hand in a different feature
    slot than a right-handed signer's, on already-thin per-class data — a real bug found while
    auditing this file, fixed here. A missing hand is zeros + a presence flag so the model can
    tell "hand at origin" from "hand absent".
  * Normalization constants (shoulder midpoint + width) are taken once per clip (median over
    frames with pose) so the normalization itself doesn't jitter, and missing-pose frames
    still get sane features. Fallback to hand-based scale if a clip never sees shoulders.
  * Time is linearly resampled to a fixed SEQ_LEN, normalizing different fps/durations.

Output: data/cache.npz with X (N, SEQ_LEN, F), y (N,), split (N,), and classes (C,).

    python -m ml.dataset --landmarks data/landmarks --manifest data/manifest.csv
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Optional

import numpy as np

SEQ_LEN = 48
N_LANDMARKS = 21
PER_HAND = N_LANDMARKS * 2          # x, y only
PER_HAND_F = PER_HAND + 1           # + presence flag
FEAT_DIM = PER_HAND_F * 2           # two hands -> 86
ROLE_SLOTS = ("Dominant", "Nondominant")

# Hand landmark indices (mirror core/landmarks.py) for the fallback scale + role assignment.
WRIST, MIDDLE_MCP = 0, 9
INDEX_MCP, RING_MCP, PINKY_MCP = 5, 13, 17
PALM_POINTS = (WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP)


def _hand_center(points) -> np.ndarray:
    """Palm-center proxy: mean of wrist + finger MCPs. Mirrors core/landmarks.py's Hand.center."""
    pts = np.asarray(points, float)
    return pts[list(PALM_POINTS), :2].mean(axis=0)


def _path_length(centers: list) -> float:
    if len(centers) < 2:
        return 0.0
    pts = np.stack(centers)
    return float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))


def assign_roles(frames: list[dict]) -> dict[str, str]:
    """Map Dominant/Nondominant to detected MediaPipe handedness labels by relative motion —
    same heuristic as core/verifier.py's assign_roles() and web/src/engine/verifier.ts's
    assignRoles() (whichever hand's palm-center travels farther across the clip is dominant)."""
    labels: list[str] = []
    for fr in frames:
        for h in fr["hands"]:
            if h["handedness"] not in labels:
                labels.append(h["handedness"])
    if not labels:
        return {}
    if len(labels) == 1:
        return {"Dominant": labels[0]}

    centers_by_label: dict[str, list] = {label: [] for label in labels}
    for fr in frames:
        for h in fr["hands"]:
            centers_by_label[h["handedness"]].append(_hand_center(h["points"]))

    labels.sort(key=lambda label: _path_length(centers_by_label[label]), reverse=True)
    return {"Dominant": labels[0], "Nondominant": labels[1]}


# ----------------------------------------------------------------- per-clip normalization

def _clip_norm(frames: list[dict]) -> tuple[np.ndarray, float]:
    """Return (mid_xy, scale) constants for a clip from median shoulder geometry."""
    mids, widths = [], []
    for fr in frames:
        ls, rs = fr.get("left_shoulder"), fr.get("right_shoulder")
        if ls is not None and rs is not None:
            ls, rs = np.asarray(ls, float), np.asarray(rs, float)
            w = float(np.linalg.norm(ls - rs))
            if w > 1e-6:
                mids.append((ls + rs) / 2.0)
                widths.append(w)
    if widths:
        return np.median(np.stack(mids), axis=0), float(np.median(widths))

    # Fallback: no pose anywhere. Center on median wrist, scale by median hand span.
    wrists, spans = [], []
    for fr in frames:
        for h in fr["hands"]:
            pts = np.asarray(h["points"], float)
            wrists.append(pts[WRIST, :2])
            spans.append(float(np.linalg.norm(pts[WRIST, :2] - pts[MIDDLE_MCP, :2])))
    if spans:
        # A hand span is ~0.3 shoulder-widths; scale up so magnitudes land in a similar range.
        return np.median(np.stack(wrists), axis=0), max(float(np.median(spans)) / 0.3, 1e-6)
    return np.zeros(2), 1.0


def _frame_features(fr: dict, mid: np.ndarray, scale: float, roles: dict[str, str]) -> np.ndarray:
    """86-dim feature for one frame: [Dominant 42 + flag, Nondominant 42 + flag]."""
    out = np.zeros(FEAT_DIM, dtype=np.float32)
    by_hand = {h["handedness"]: h for h in fr["hands"]}
    for slot, role in enumerate(ROLE_SLOTS):
        base = slot * PER_HAND_F
        label = roles.get(role)
        h = by_hand.get(label) if label else None
        if h is not None:
            pts = np.asarray(h["points"], float)[:, :2]
            norm = ((pts - mid) / scale).reshape(-1)
            out[base:base + PER_HAND] = norm
            out[base + PER_HAND] = 1.0
    return out


def clip_to_sequence(payload: dict, seq_len: int = SEQ_LEN) -> Optional[np.ndarray]:
    """Frame-JSON payload -> (seq_len, FEAT_DIM) array, or None if empty/no hands.

    Trims leading/trailing no-hand frames first, so the fixed-length window concentrates on
    the actual sign rather than the rest pose at a dictionary clip's edges (interior dropouts
    are kept — presence flags handle them).
    """
    frames = payload.get("frames", [])
    if not frames:
        return None
    hand_idx = [i for i, fr in enumerate(frames) if fr["hands"]]
    if not hand_idx:
        return None
    frames = frames[hand_idx[0]: hand_idx[-1] + 1]
    mid, scale = _clip_norm(frames)
    roles = assign_roles(frames)
    feats = np.stack([_frame_features(fr, mid, scale, roles) for fr in frames])  # (N, F)
    return _resample_time(feats, seq_len)


def _resample_time(feats: np.ndarray, seq_len: int) -> np.ndarray:
    """Linearly resample a (N, F) sequence to (seq_len, F)."""
    n = feats.shape[0]
    if n == seq_len:
        return feats.astype(np.float32)
    src = np.linspace(0.0, n - 1, num=seq_len)
    lo = np.floor(src).astype(int)
    hi = np.minimum(lo + 1, n - 1)
    frac = (src - lo)[:, None]
    return (feats[lo] * (1 - frac) + feats[hi] * frac).astype(np.float32)


# ----------------------------------------------------------------- build

def _read_manifest(path: Path) -> dict[str, str]:
    """clip_id -> split. Empty dict if no manifest (everything defaults to train)."""
    splits: dict[str, str] = {}
    if path.exists():
        with open(path, newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                splits[r["clip_id"]] = r.get("split", "train")
    return splits


def build(landmarks_dir, manifest, out: str, seq_len: int = SEQ_LEN) -> None:
    """Build a cache from one OR MORE landmark roots (merged). `landmarks_dir` and
    `manifest` may each be a single path or a list of paths — pass parallel lists to merge
    several datasets (e.g. ASL Citizen + WLASL) into one signer-disjoint cache."""
    roots = [Path(p) for p in ([landmarks_dir] if isinstance(landmarks_dir, str) else landmarks_dir)]
    man_paths = [manifest] if isinstance(manifest, str) else list(manifest)

    # Merge all manifests into one clip_id -> split map (later manifests win on collision).
    split_map: dict[str, str] = {}
    for mp in man_paths:
        split_map.update(_read_manifest(Path(mp)))

    X, y, splits, raw_labels, origins = [], [], [], [], []
    skipped = 0
    for root in roots:
        # Origin = the dataset root's own parent folder name (data/asl_citizen/landmarks ->
        # "asl_citizen", data/ms_asl/landmarks -> "ms_asl", ...) — reuses the directory
        # convention every source already follows instead of adding a separate config knob.
        # Enables cross-dataset validation: train on N-1 origins, hold one out entirely, to
        # catch a model learning dataset-specific shortcuts (framing/compression/watermarks)
        # rather than the sign itself.
        origin = root.parent.name
        for jp in sorted(root.rglob("*.json")):
            payload = json.loads(jp.read_text(encoding="utf-8"))
            seq = clip_to_sequence(payload, seq_len)
            if seq is None:
                skipped += 1
                continue
            sign = payload["sign_name"]
            clip_id = f"{jp.parent.name}/{jp.stem}"
            X.append(seq)
            raw_labels.append(sign)
            splits.append(split_map.get(clip_id, "train"))
            origins.append(origin)

    if not X:
        print("no usable clips found — nothing to cache")
        return

    classes = sorted(set(raw_labels))
    cls_idx = {c: i for i, c in enumerate(classes)}
    y = np.array([cls_idx[s] for s in raw_labels], dtype=np.int64)
    X = np.stack(X).astype(np.float32)
    splits = np.array(splits)
    origins = np.array(origins)

    out_path = Path(out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out_path, X=X, y=y, split=splits, classes=np.array(classes), origin=origins)

    print(f"cache -> {out_path}")
    print(f"  X={X.shape}  y={y.shape}  classes={len(classes)}  skipped={skipped}")
    for split in ("train", "val", "test"):
        print(f"  {split}: {(splits == split).sum()} clips")
    for o in sorted(set(origins.tolist())):
        print(f"  origin={o}: {(origins == o).sum()} clips")


def main() -> None:
    p = argparse.ArgumentParser(description="Build training cache from Frame JSON landmarks.")
    p.add_argument("--landmarks", nargs="+", default=["data/landmarks"],
                   help="one or more landmark roots (merged)")
    p.add_argument("--manifest", nargs="+", default=["data/manifest.csv"],
                   help="one or more manifests (merged; parallel to --landmarks)")
    p.add_argument("--out", default="data/cache.npz")
    p.add_argument("--seq-len", type=int, default=SEQ_LEN)
    args = p.parse_args()
    build(args.landmarks, args.manifest, args.out, args.seq_len)


if __name__ == "__main__":
    main()
