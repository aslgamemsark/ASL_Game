"""Phase 3 — Procedural trajectory generators.

ASL signs move the hands through space along characteristic paths: linear strokes, circular grinds,
repeated taps, two-hand convergences. This module turns the *same* MovementReq parameters the
recognition verifier reads (kind, rotation amount, displacement, cycles, approach) into a concrete
array of points sampled over a normalized time u in [0, 1]. It is the deterministic inverse of
`core.movement`: that module measures net rotation / displacement / cycles from a path; this one
generates a path that exhibits exactly those quantities.

Everything here is pure geometry on numpy arrays — no rig, no handshape, no body. Phase 5
(`core.synthesis`) anchors these curves to body-relative coordinates and feeds the result to the
hands; the recognition verifier then re-measures them, closing the loop.

Generators are 3D-capable (the procedural-avatar pipeline targets Three.js Vector3 paths); a 2D
image-plane caller simply passes z=0 vectors and ignores the third component.
"""
from __future__ import annotations

from typing import Callable

import numpy as np

# A normalized-time easing maps u in [0, 1] -> eased s in [0, 1]. Linear motion at constant velocity
# reads as robotic; real muscle accelerates and decelerates, so paths are sampled through an easing.
Easing = Callable[[np.ndarray], np.ndarray]


def ease_linear(u: np.ndarray) -> np.ndarray:
    return u


def ease_sine_in_out(u: np.ndarray) -> np.ndarray:
    """Sine ease-in-out — smooth acceleration and deceleration, the default biological easing."""
    return 0.5 * (1.0 - np.cos(np.pi * np.clip(u, 0.0, 1.0)))


def ease_cubic_in_out(u: np.ndarray) -> np.ndarray:
    u = np.clip(u, 0.0, 1.0)
    return np.where(u < 0.5, 4.0 * u ** 3, 1.0 - np.power(-2.0 * u + 2.0, 3) / 2.0)


def normalized_time(n: int, easing: Easing = ease_sine_in_out) -> np.ndarray:
    """`n` eased samples of u in [0, 1] (n>=2). The clock the generators below sample against."""
    n = max(int(n), 2)
    return easing(np.linspace(0.0, 1.0, n))


def _as_vec(p) -> np.ndarray:
    return np.asarray(p, dtype=float)


def linear_path(start, end, n: int, easing: Easing = ease_sine_in_out) -> np.ndarray:
    """Straight stroke from `start` to `end`, eased. Shape (n, dim)."""
    s, e = _as_vec(start), _as_vec(end)
    t = normalized_time(n, easing)[:, None]
    return s[None, :] + (e - s)[None, :] * t


def _plane_basis(normal) -> tuple[np.ndarray, np.ndarray]:
    """Two orthonormal vectors spanning the plane with the given normal (the circle's plane)."""
    n = _as_vec(normal)
    nn = np.linalg.norm(n)
    n = n / nn if nn > 1e-9 else np.array([0.0, 0.0, 1.0])
    seed = np.array([1.0, 0.0, 0.0]) if abs(n[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = seed - n * (seed @ n)
    u /= np.linalg.norm(u)
    v = np.cross(n, u)
    return u, v


def circular_path_3d(pivot, radius: float, total_rotation_rad: float, n: int,
                     normal=(0.0, 0.0, 1.0), start_angle: float = 0.0,
                     easing: Easing = ease_sine_in_out) -> np.ndarray:
    """Arc/circle of `total_rotation_rad` radians about `pivot` in the plane `normal`. Shape (n, 3).

    P(theta) = pivot + radius * (cos theta * U + sin theta * V), with theta swept from start_angle
    across the eased time. A full grind passes total_rotation_rad >= 2*pi.
    """
    pivot = _as_vec(pivot)
    if pivot.shape[0] == 2:
        pivot = np.array([pivot[0], pivot[1], 0.0])
    u, v = _plane_basis(normal)
    theta = start_angle + total_rotation_rad * normalized_time(n, easing)
    return pivot[None, :] + radius * (np.cos(theta)[:, None] * u[None, :] +
                                      np.sin(theta)[:, None] * v[None, :])


def circular_path_2d(pivot, radius: float, total_rotation_rad: float, n: int,
                     start_angle: float = 0.0, easing: Easing = ease_sine_in_out) -> np.ndarray:
    """Image-plane circle — convenience wrapper returning (n, 2)."""
    p3 = circular_path_3d(pivot, radius, total_rotation_rad, n,
                          normal=(0.0, 0.0, 1.0), start_angle=start_angle, easing=easing)
    return p3[:, :2]


def oscillation_path(center, axis, amplitude: float, cycles: float, n: int,
                     phase: float = 0.0) -> np.ndarray:
    """Repeated/tapping motion: `center` modulated along `axis` by a sine of `cycles` periods.

    Used for noun-doubling and tap signs. The recognition verifier counts direction reversals in the
    distance-from-centroid signal; a sine of `cycles` periods produces ~`cycles` such cycles, with
    peak excursion `amplitude` along `axis`. `n` samples should span the sign's full duration.
    """
    c = _as_vec(center)
    a = _as_vec(axis)
    an = np.linalg.norm(a)
    a = a / an if an > 1e-9 else a
    u = np.linspace(0.0, 1.0, max(int(n), 2))
    offset = amplitude * np.sin(2.0 * np.pi * cycles * u + phase)
    return c[None, :] + offset[:, None] * a[None, :]


def traced_path(start, template_deg: tuple, amplitude: float, n: int,
                easing: Easing = ease_sine_in_out) -> np.ndarray:
    """Generate a path that moves through a sequence of direction phases.

    `template_deg` is a sequence of direction angles in degrees (0=right, 90=down, 180=left,
    270=up). The path starts at `start` and each phase moves `amplitude` units in the specified
    direction. Returns exactly `n` frames by interpolating along the piecewise-linear skeleton.
    """
    s = _as_vec(start)
    # Build the skeleton waypoints: start + one waypoint per phase
    waypoints = [s]
    pos = s.copy()
    for deg in template_deg:
        rad = np.radians(deg)
        pos = pos + np.array([np.cos(rad), np.sin(rad)]) * amplitude
        waypoints.append(pos.copy())
    waypoints = np.array(waypoints)  # (n_phases+1) x 2

    # Compute cumulative arc length along the skeleton
    seg_lens = np.linalg.norm(np.diff(waypoints, axis=0), axis=1)
    cum_len = np.concatenate([[0.0], np.cumsum(seg_lens)])
    total_len = cum_len[-1]

    # Resample to n evenly-spaced points along arc length (with easing applied to the parameter)
    u = normalized_time(n, easing)   # 0..1 eased
    arc_targets = u * total_len
    result = np.empty((n, waypoints.shape[1]))
    for i, target in enumerate(arc_targets):
        # find which segment this arc length falls in
        seg = int(np.searchsorted(cum_len, target, side='right')) - 1
        seg = np.clip(seg, 0, len(seg_lens) - 1)
        t_along = 0.0 if seg_lens[seg] < 1e-9 else (target - cum_len[seg]) / seg_lens[seg]
        result[i] = waypoints[seg] + t_along * (waypoints[seg + 1] - waypoints[seg])
    return result


def converge_paths(start_a, start_b, n: int, gap_close_frac: float = 0.6,
                   easing: Easing = ease_sine_in_out) -> tuple[np.ndarray, np.ndarray]:
    """Two hands moving toward their shared midpoint, closing the gap by `gap_close_frac`.

    Returns (path_a, path_b). At u=1 the inter-hand gap is (1 - gap_close_frac) of its start value,
    so the recognition CONVERGE detector sees the gap shrink by `gap_close_frac` of the original.
    """
    a, b = _as_vec(start_a), _as_vec(start_b)
    mid = 0.5 * (a + b)
    end_a = a + (mid - a) * gap_close_frac
    end_b = b + (mid - b) * gap_close_frac
    return linear_path(a, end_a, n, easing), linear_path(b, end_b, n, easing)
