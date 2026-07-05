"""Movement detectors over the rolling buffer — the core of the anti-bug fix.

Each detector reads a *trajectory* (a list of (t, center) samples spanning the window), never a
single frame. Confidences are in [0, 1].

  - circular: the acting hand's center angle about its own path centroid; unwrapped + summed;
    radius stability check rejects random wandering. Calibrated on real hands (_RADIUS_CV_FREE).
  - linear: window start->end displacement, direction, and monotonic progression.
  - repeated: oscillation cycles in the distance-from-mean signal.
  - converge: two-hand version — gap between both hands closing over the window (PAIN).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from core.schema import MovementKind, MovementReq

# Radius coefficient-of-variation below which a circle gets FULL radius credit. Real human
# grinding is never a perfect circle, so we don't start penalizing until cv exceeds this.
_RADIUS_CV_FREE = 0.30


def _series(traj):
    ts = np.array([t for t, _ in traj], dtype=float)
    pts = np.array([np.asarray(c, dtype=float) for _, c in traj], dtype=float)
    return ts, pts


@dataclass
class CircularMetrics:
    """Sub-scores behind a circular-movement confidence — surfaced for live calibration."""

    score: float
    net_rotation_deg: float
    radius_cv: float
    mean_r_ratio: float
    n: int
    duration: float


def circular_metrics(actor_traj, shoulder_width: float, req: MovementReq) -> CircularMetrics:
    """Measure how circular the acting hand's path is about its own centroid."""
    n = len(actor_traj)
    if n < 5 or shoulder_width is None or shoulder_width <= 0:
        return CircularMetrics(0.0, 0.0, 99.0, 0.0, n, 0.0)

    ts, a = _series(actor_traj)
    duration = float(ts[-1] - ts[0])
    pivot = a.mean(axis=0)
    rel = a - pivot
    radii = np.linalg.norm(rel, axis=1)
    mean_r = float(radii.mean())
    mean_r_ratio = mean_r / shoulder_width
    angles = np.unwrap(np.arctan2(rel[:, 1], rel[:, 0]))
    net_rotation = abs(float(np.degrees(angles[-1] - angles[0])))
    radius_cv = float(radii.std() / mean_r) if mean_r > 1e-6 else 99.0

    if duration < req.min_duration_s or mean_r_ratio < 0.03:
        return CircularMetrics(0.0, net_rotation, radius_cv, mean_r_ratio, n, duration)

    rotation_score = float(np.clip(net_rotation / req.min_total_rotation_deg, 0.0, 1.0))
    radius_excess = max(0.0, radius_cv - _RADIUS_CV_FREE)
    radius_score = float(np.clip(1.0 - radius_excess / max(req.radius_tolerance_ratio, 1e-6), 0.0, 1.0))
    score = rotation_score * radius_score
    return CircularMetrics(score, net_rotation, radius_cv, mean_r_ratio, n, duration)


def circular_confidence(actor_traj, shoulder_width: float, req: MovementReq) -> float:
    return circular_metrics(actor_traj, shoulder_width, req).score


def linear_confidence(actor_traj, shoulder_width: float, req: MovementReq) -> float:
    if len(actor_traj) < 3 or shoulder_width is None or shoulder_width <= 0:
        return 0.0
    ts, a = _series(actor_traj)
    if ts[-1] - ts[0] < req.min_duration_s:
        return 0.0

    disp = a[-1] - a[0]
    mag = float(np.linalg.norm(disp))
    mag_ratio = mag / shoulder_width
    # Hard floor: a near-still hand (incidental jitter/repositioning) is never "linear motion",
    # regardless of the sign's min_displacement_ratio.
    if mag_ratio < 0.05:
        return 0.0
    mag_score = float(np.clip(mag_ratio / req.min_displacement_ratio, 0.0, 1.0))

    unit = disp / mag
    dir_score = 1.0
    if req.direction is not None:
        d = np.asarray(req.direction, dtype=float)
        dn = np.linalg.norm(d)
        if dn > 1e-6:
            dir_score = float(np.clip(unit @ (d / dn), 0.0, 1.0))

    # Monotonic progression is intentionally NOT required: net displacement (mag) + direction
    # already reject jitter and back-and-forth (which have small net displacement), and demanding
    # strict frame-by-frame monotonicity made real human motion feel stiff / fail intermittently.
    return mag_score * dir_score


def repeated_confidence(actor_traj, shoulder_width: float, req: MovementReq) -> float:
    if len(actor_traj) < 6 or shoulder_width is None or shoulder_width <= 0:
        return 0.0
    ts, a = _series(actor_traj)
    if ts[-1] - ts[0] < req.min_duration_s:
        return 0.0

    # distance of the hand from the centroid of its own path
    signal = np.linalg.norm(a - a.mean(axis=0), axis=1)

    # A genuine repeated motion has real AMPLITUDE. Reject jitter / a near-still hand outright —
    # this is what stops a barely-moving claw from racking up false "cycles" and passing. The floor
    # is per-sign (req.min_amplitude_ratio) so deliberate signs like BREATHE can demand a big swing.
    amp_floor = max(req.min_amplitude_ratio, 1e-6)
    amp_ratio = float(signal.max() - signal.min()) / shoulder_width
    if amp_ratio < amp_floor:
        return 0.0

    centered = signal - signal.mean()
    # Count direction reversals only when the swing clears a noise band, so micro-wiggles near the
    # mean don't inflate the cycle count.
    #
    # A percentile-of-itself floor was tried here and reverted: it made genuine repeated motion less
    # sensitive to one large unrelated excursion, but it is exploitable — natural hand tremor while
    # HOLDING STILL is self-similar noise, so a threshold relative to its own spread always clears
    # it too. Verified against a real recorded "hold two hands still, no signing" take: the max-based
    # floor below correctly scores it ~0.25 (well under the 0.6 pass threshold) at the app's real
    # 2.0s window, while the percentile version scored ~0.75 (a false pass) on the same recording.
    # A sign that's occasionally hard to pass on a genuine attempt is an inconvenience; a sign that
    # passes while doing nothing is the exact bug class this engine must never ship.
    noise = 0.25 * float(np.max(np.abs(centered)))
    crossings, last = 0, 0
    for v in centered:
        if abs(v) < noise:
            continue
        cur = 1 if v > 0 else -1
        if last != 0 and cur != last:
            crossings += 1
        last = cur
    cycles = crossings / 2.0

    cycle_score = float(np.clip(cycles / max(req.min_cycles, 1), 0.0, 1.0))
    amp_score = float(np.clip(amp_ratio / (amp_floor * 1.6), 0.0, 1.0))
    # Need BOTH enough cycles AND enough amplitude: a tiny tremor with many reversals fails on
    # amplitude; a single big sweep with no reversals fails on cycles.
    return float(min(cycle_score, amp_score))


_CONVERGE_TAIL_S = 0.6      # how far back to look for "how close did they just get"
_CONVERGE_TOUCH_RATIO = 0.25  # closest-point distance below this reads as a real touch


def converge_confidence(traj_a, traj_b, shoulder_width: float, req: MovementReq) -> float:
    """How close the two hands' nearest points got, after genuinely being farther apart.

    `traj_a`/`traj_b` are aligned frame-by-frame (t, all 21 landmark points) for the two hands
    (only frames where both are present). Uses CLOSEST-POINT distance (fingertip to fingertip),
    not palm-center distance: palm centers stay a hand-width apart even when fingertips actually
    touch, so a center-based gap never gets close to the real "did they touch" signal — a live test
    found that natural arm drift/settling over several seconds could shrink the center-to-center
    gap by as much as a deliberate approach, without fingers ever coming close. Verified against
    real recordings: genuine touches reach closest-point distance ~0.02-0.07 shoulder-widths; both
    a frozen held-apart pose AND incidental drift stay ~0.6-0.75 the whole time.
    """
    n = min(len(traj_a), len(traj_b))
    if n < 3 or shoulder_width <= 0:
        return 0.0

    ts = np.array([t for t, _ in traj_a[:n]], dtype=float)
    if ts[-1] - ts[0] < req.min_duration_s:
        return 0.0

    gap = np.empty(n, dtype=float)
    for i in range(n):
        pa = traj_a[i][1]
        pb = traj_b[i][1]
        gap[i] = float(np.min(np.linalg.norm(pa[:, None, :] - pb[None, :, :], axis=2))) / shoulder_width

    tail = ts >= ts[-1] - _CONVERGE_TAIL_S
    recent_min = float(gap[tail].min())
    window_max = float(gap.max())

    touch_score = float(np.clip((_CONVERGE_TOUCH_RATIO - recent_min) / _CONVERGE_TOUCH_RATIO, 0.0, 1.0))
    approach = window_max - recent_min
    approach_score = float(np.clip(approach / max(req.min_approach_ratio, 1e-6), 0.0, 1.0))
    # Need BOTH a real touch AND a genuine approach from farther away: touch_score alone would
    # accept hands that started already touching and never moved (the class of static-pose bug
    # this engine must reject); approach_score alone would accept hands that got closer without
    # ever actually touching (the drift/settling false-positive this replaces).
    return float(min(touch_score, approach_score))


def traced_confidence(actor_traj, shoulder_width: float, req: MovementReq) -> float:
    """Score how closely the trajectory matches a sequence of expected direction vectors.

    The trajectory is split into len(req.trace_template) equal-duration phases. Each phase's
    net displacement is compared to the expected direction angle (0°=right, 90°=down in image
    coords, 180°=left, 270°=up). Phases too small to measure (sub-pixel motion within a phase)
    contribute 0. Overall score is the geometric mean of per-phase scores so every phase must
    be directionally correct — one phase scoring 0 kills the total.
    """
    n_phases = len(req.trace_template)
    if n_phases < 2 or len(actor_traj) < n_phases * 2:
        return 0.0
    if shoulder_width is None or shoulder_width <= 0:
        return 0.0

    ts, pts = _series(actor_traj)
    duration = float(ts[-1] - ts[0])
    if duration < req.min_duration_s:
        return 0.0

    # Minimum total path length (not net displacement — need to actually move through each phase)
    total_path = float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum()) / shoulder_width
    if total_path < req.min_displacement_ratio:
        return 0.0

    tol_cos = float(np.cos(np.radians(req.trace_tolerance_deg)))
    phase_scores: list[float] = []
    t_start = float(ts[0])

    for i, target_deg in enumerate(req.trace_template):
        t_lo = t_start + i * duration / n_phases
        t_hi = t_start + (i + 1) * duration / n_phases
        mask = (ts >= t_lo) & (ts <= t_hi)
        phase_pts = pts[mask]
        if len(phase_pts) < 2:
            phase_scores.append(0.0)
            continue

        disp = phase_pts[-1] - phase_pts[0]
        mag = float(np.linalg.norm(disp))
        if mag < 1e-6:
            phase_scores.append(0.0)
            continue

        target_rad = np.radians(target_deg)
        target_vec = np.array([np.cos(target_rad), np.sin(target_rad)])
        dot = float(np.dot(disp / mag, target_vec))
        # Linear ramp: 1.0 at exact match, 0.0 at the tolerance boundary, 0.0 beyond it
        phase_score = float(np.clip((dot - tol_cos) / max(1.0 - tol_cos, 1e-6), 0.0, 1.0))
        phase_scores.append(phase_score)

    if not phase_scores or any(s == 0.0 for s in phase_scores):
        return 0.0
    return float(np.prod(phase_scores) ** (1.0 / len(phase_scores)))  # geometric mean


def movement_confidence(actor_traj, shoulder_width: float, req: MovementReq) -> float:
    """Dispatch on the required movement kind. NONE trivially satisfied; CONVERGE uses two trajs."""
    if req.kind == MovementKind.NONE:
        return 1.0
    if req.kind == MovementKind.CIRCULAR:
        return circular_confidence(actor_traj, shoulder_width, req)
    if req.kind == MovementKind.LINEAR:
        return linear_confidence(actor_traj, shoulder_width, req)
    if req.kind == MovementKind.REPEATED:
        return repeated_confidence(actor_traj, shoulder_width, req)
    if req.kind == MovementKind.TRACED:
        return traced_confidence(actor_traj, shoulder_width, req)
    # CONVERGE needs two trajectories — called directly from the verifier; return 0 if reached here.
    return 0.0
