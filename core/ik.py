"""Phase 4 — Analytical (closed-form) 2-bone inverse kinematics.

The human upper limb is a 2-link chain: upper arm (shoulder->elbow) and forearm (elbow->wrist).
Given where we want the wrist (the trajectory point from Phase 3), the IK solver returns the elbow
and wrist positions — i.e. the bend that lands the hand on target. We use the *analytical* solver
(Law of Cosines) rather than an iterative one (FABRIK/CCD): for a 2-bone chain it is exact,
single-pass, and deterministic, so the same target always yields the same pose with no iteration,
no popping near singularities, and no per-frame jitter.

The math (per the procedural-avatar report, Phase 4):
  d = |target - shoulder|. If d exceeds reach (l1 + l2) the arm is straightened toward the target
  and clamped (geometry can't tear); if below |l1 - l2| it is clamped open. Otherwise the interior
  shoulder angle is  alpha = acos((l1^2 + d^2 - l2^2) / (2*l1*d)).
  The elbow lies on a circle around the shoulder->target axis (infinitely many solutions); the POLE
  VECTOR (a hint coordinate, e.g. below/behind the torso) selects one by fixing the bend plane, so
  elbows hang naturally instead of snapping to arbitrary orientations.

Works in 3D (the avatar pipeline) and degenerates cleanly to 2D image space (z = 0) for the
preview renderer.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

_EPS = 1e-9


@dataclass
class ArmPose:
    """Result of a 2-bone solve: the three joint positions plus whether the target was out of reach."""

    shoulder: np.ndarray
    elbow: np.ndarray
    wrist: np.ndarray
    clamped: bool

    @property
    def upper_len(self) -> float:
        return float(np.linalg.norm(self.elbow - self.shoulder))

    @property
    def fore_len(self) -> float:
        return float(np.linalg.norm(self.wrist - self.elbow))


def _vec3(p) -> np.ndarray:
    p = np.asarray(p, dtype=float)
    if p.shape[0] == 2:
        return np.array([p[0], p[1], 0.0])
    return p.astype(float)


def solve_two_bone(shoulder, target, upper_len: float, fore_len: float,
                   pole=None) -> ArmPose:
    """Closed-form 2-bone IK. Returns joint positions in the same space as the inputs.

    `pole` is the elbow hint; if omitted, a default below-and-toward-camera hint is used so the
    elbow bends downward (the natural rest direction for a signing arm).
    """
    s = _vec3(shoulder)
    t = _vec3(target)
    l1 = float(upper_len)
    l2 = float(fore_len)

    to_target = t - s
    d = float(np.linalg.norm(to_target))
    clamped = False

    if d < _EPS:
        # Degenerate: target on top of the shoulder. Point straight down by convention.
        axis = np.array([0.0, 1.0, 0.0])
        d = min(l1 + l2, max(abs(l1 - l2) + _EPS, _EPS))
        t = s + axis * d
        to_target = t - s
    axis = to_target / d

    reach = l1 + l2
    floor = abs(l1 - l2)
    if d >= reach:                         # out of reach: straighten and clamp onto the line
        elbow = s + axis * l1
        wrist = s + axis * reach
        return ArmPose(s, elbow, wrist, True)
    if d <= floor + _EPS:                  # too close: open the joint, clamp
        d = floor + _EPS
        clamped = True

    # Interior shoulder angle between the upper arm and the shoulder->target axis.
    cos_alpha = float(np.clip((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0))
    alpha = float(np.arccos(cos_alpha))

    bend = _bend_direction(s, axis, pole)
    elbow = s + l1 * (np.cos(alpha) * axis + np.sin(alpha) * bend)
    # With a reachable target the forearm closes exactly onto it; recompute from the elbow so any
    # floating-point drift in the wrist lands on the true target rather than accumulating.
    if not clamped:
        wrist = t.copy()
    else:
        wrist = elbow + fore_len * _safe_unit(t - elbow)
    return ArmPose(s, elbow, wrist, clamped)


def _safe_unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n > _EPS else np.array([0.0, 1.0, 0.0])


def _bend_direction(shoulder: np.ndarray, axis: np.ndarray, pole) -> np.ndarray:
    """Unit vector in the shoulder->target-perpendicular plane pointing toward the pole hint."""
    if pole is None:
        # Default hint: below and slightly toward the camera, so the elbow drops naturally.
        pole_pt = shoulder + np.array([0.0, 1.0, 0.4])
    else:
        pole_pt = _vec3(pole)
    rel = pole_pt - shoulder
    bend = rel - axis * float(rel @ axis)          # project out the component along the arm axis
    n = float(np.linalg.norm(bend))
    if n > _EPS:
        return bend / n
    # Pole is colinear with the arm axis — pick any stable perpendicular.
    seed = np.array([0.0, 1.0, 0.0]) if abs(axis[1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    bend = seed - axis * float(seed @ axis)
    return _safe_unit(bend)
