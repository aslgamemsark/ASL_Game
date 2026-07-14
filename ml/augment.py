"""Landmark-sequence augmentation (pure numpy) — multiplies the thin ~30/sign data.

Operates on the (T, 86) feature sequences from ml/dataset.py. All transforms touch ONLY the
(x, y) coordinate channels, never the per-hand presence flags, and never invent a hand where
one was absent.

SAFE transforms (enabled): small rotation, scaling, temporal warp, coordinate jitter, per-
landmark keypoint dropout (partial occlusion — a hand present but with a few unreliable points,
distinct from the existing presence flag's only other state, "hand absent entirely").
UNSAFE (deliberately NOT here): horizontal mirroring — it swaps the dominant hand and inverts
palm orientation, corrupting labels for two-handed / asymmetric / orientation-sensitive signs.
Only mirror if you also swap handedness slots + flip orientation targets; left out for v1.
"""
from __future__ import annotations

import numpy as np

# Feature layout (mirror ml/dataset.py): two slots of [42 coords, 1 flag].
PER_HAND = 42
PER_HAND_F = 43
N_LANDMARKS = 21


def _coord_view(seq: np.ndarray, slot: int) -> np.ndarray:
    """Return a (T, 21, 2) VIEW of one hand slot's coordinates (writable)."""
    base = slot * PER_HAND_F
    block = seq[:, base:base + PER_HAND]            # (T, 42)
    return block.reshape(seq.shape[0], N_LANDMARKS, 2)


def _present(seq: np.ndarray, slot: int) -> np.ndarray:
    """(T,) boolean: was this hand present in each frame?"""
    base = slot * PER_HAND_F
    return seq[:, base + PER_HAND] > 0.5


def rotate(seq: np.ndarray, deg: float) -> np.ndarray:
    out = seq.copy()
    r = np.deg2rad(deg)
    c, s = np.cos(r), np.sin(r)
    rot = np.array([[c, -s], [s, c]], dtype=np.float32)
    for slot in (0, 1):
        coords = _coord_view(out, slot)
        pres = _present(out, slot)
        coords[pres] = coords[pres] @ rot.T
    return out


def scale(seq: np.ndarray, factor: float) -> np.ndarray:
    out = seq.copy()
    for slot in (0, 1):
        coords = _coord_view(out, slot)
        pres = _present(out, slot)
        coords[pres] *= factor
    return out


def jitter(seq: np.ndarray, sigma: float, rng: np.random.Generator) -> np.ndarray:
    out = seq.copy()
    for slot in (0, 1):
        coords = _coord_view(out, slot)
        pres = _present(out, slot)
        noise = rng.normal(0.0, sigma, size=coords.shape).astype(np.float32)
        coords[pres] += noise[pres]
    return out


def keypoint_dropout(seq: np.ndarray, drop_prob: float, rng: np.random.Generator) -> np.ndarray:
    """Zero a random subset of individual landmark POINTS (not the whole hand) on present hands,
    simulating partial occlusion/motion blur — a common real webcam failure mode the presence
    flag alone can't represent (it only distinguishes "hand absent" from "hand present"; a model
    trained only on those two states has never seen "present but a few points are unreliable").
    Hand-level presence flags are untouched — this is strictly finer-grained than absence.
    """
    out = seq.copy()
    for slot in (0, 1):
        coords = _coord_view(out, slot)
        pres = _present(out, slot)
        if not pres.any():
            continue
        sub = coords[pres]  # (n_present_frames, 21, 2)
        drop = rng.random((sub.shape[0], N_LANDMARKS)) < drop_prob
        sub[drop] = 0.0
        coords[pres] = sub
    return out


def time_warp(seq: np.ndarray, factor: float) -> np.ndarray:
    """Resample to the same length along a slightly sped/slowed timeline."""
    t = seq.shape[0]
    # Warp the sampling positions then renormalize back to [0, t-1].
    pos = np.linspace(0.0, 1.0, t) ** factor
    src = pos * (t - 1)
    lo = np.floor(src).astype(int)
    hi = np.minimum(lo + 1, t - 1)
    frac = (src - lo)[:, None]
    warped = seq[lo] * (1 - frac) + seq[hi] * frac
    # Re-binarize presence flags so interpolation doesn't create 0.5 ghosts.
    for slot in (0, 1):
        base = slot * PER_HAND_F
        warped[:, base + PER_HAND] = (warped[:, base + PER_HAND] > 0.5).astype(np.float32)
    return warped.astype(np.float32)


def augment_sequence(seq: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """One random composed augmentation of a single (T, 86) sequence."""
    out = rotate(seq, rng.uniform(-16.0, 16.0))
    out = scale(out, rng.uniform(0.82, 1.18))
    out = time_warp(out, rng.uniform(0.80, 1.25))
    out = jitter(out, rng.uniform(0.006, 0.028), rng)
    out = keypoint_dropout(out, rng.uniform(0.0, 0.06), rng)
    return out


def augment_dataset(X: np.ndarray, y: np.ndarray, n_aug: int,
                    seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Return originals + n_aug augmented copies each. Shapes (N*(1+n_aug), T, F)."""
    rng = np.random.default_rng(seed)
    xs, ys = [X], [y]
    for _ in range(n_aug):
        xs.append(np.stack([augment_sequence(s, rng) for s in X]))
        ys.append(y.copy())
    return np.concatenate(xs).astype(np.float32), np.concatenate(ys)


# --------------------------------------------------------------- self-test
if __name__ == "__main__":
    rng = np.random.default_rng(0)
    seq = rng.normal(size=(48, 86)).astype(np.float32)
    seq[:, PER_HAND] = 1.0          # right present
    # Left hand absent: zero coords AND zero flag, exactly as dataset.py emits.
    seq[:, PER_HAND_F:2 * PER_HAND_F] = 0.0

    assert np.allclose(rotate(seq, 0.0), seq, atol=1e-5), "rotate(0) must be identity"
    # Absent hand must stay all-zero coords after every transform.
    for fn in (lambda s: rotate(s, 10), lambda s: scale(s, 1.1),
               lambda s: jitter(s, 0.01, rng), lambda s: time_warp(s, 1.1),
               lambda s: keypoint_dropout(s, 0.3, rng)):
        out = fn(seq)
        left = _coord_view(out, 1)
        assert np.allclose(left, 0.0), "absent hand coords must remain zero"
        # presence flags preserved (0/1 only)
        flags = out[:, [PER_HAND, 2 * PER_HAND_F - 1]]
        assert set(np.unique(flags)).issubset({0.0, 1.0}), "flags must stay binary"

    # keypoint_dropout is strictly finer-grained than presence: the RIGHT hand (present) must
    # keep its presence flag at 1 even though some of its individual points get zeroed.
    kd = keypoint_dropout(seq, 0.5, rng)
    assert np.all(kd[:, PER_HAND] == 1.0), "present hand's presence flag must survive keypoint dropout"
    right_coords = _coord_view(kd, 0)
    n_zeroed = int(np.sum(np.all(right_coords == 0.0, axis=-1)))
    assert n_zeroed > 0, "a 0.5 drop probability should zero at least some points"
    print("augment self-test: OK")
