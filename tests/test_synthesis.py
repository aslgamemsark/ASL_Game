"""Procedural synthesis regression tests — the bilateral-error guard.

These tests assert the central rule of the procedural-avatar architecture: synthesis and recognition
share one schema, so a sign synthesized from its schema must be recognized by the verifier built from
the SAME schema, and a frozen (motionless) copy of a movement sign must be rejected. This is the
synthesis-side descendant of the original single-frame COFFEE bug: it fails loudly if the assembly
script ever stops producing real movement, or if a movement gate is weakened.

It also unit-tests the deterministic building blocks: handshape presets (must score against the
recognition predicates), trajectory generators (must exhibit the quantities the movement detectors
measure), and the analytical 2-bone IK solver (must hit reachable targets exactly).
"""
from __future__ import annotations

import numpy as np
import pytest

from core import movement as mv
from core import trajectory as tj
from core.calibration import CalibrationLog, self_verify
from core.handshape import handshape_confidence
from core.handshape_presets import local_hand, supported_shapes
from core.ik import solve_two_bone
from core.landmarks import Hand
from core.schema import MovementKind, MovementReq
from core.synthesis import synthesize
from core.verifier import verify
from signs import SIGNS

SIGN_ITEMS = sorted(SIGNS.items())
SIGN_IDS = [name for name, _ in SIGN_ITEMS]


# --------------------------------------------------------------------------- bilateral round-trip
@pytest.mark.parametrize("name,sign", SIGN_ITEMS, ids=SIGN_IDS)
def test_synthesized_sign_is_recognized(name, sign):
    """Every registered sign, synthesized from its schema, must pass its own verifier."""
    result = verify(synthesize(sign).buffer(), sign)
    assert result.passed, f"{name} synthesized clip failed on: {result.failing_required}"


@pytest.mark.parametrize("name,sign", SIGN_ITEMS, ids=SIGN_IDS)
def test_static_confusor_is_rejected(name, sign):
    """A frozen copy of any movement-required sign must FAIL — no single-frame approval."""
    if not sign.movement.required:
        pytest.skip("sign requires no movement; nothing to freeze")
    result = verify(synthesize(sign, static=True).buffer(), sign)
    assert not result.passed, f"{name} frozen confusor leaked through (movement not enforced!)"
    assert "movement" in result.failing_required, (
        f"{name} frozen confusor should fail specifically on movement: {result.failing_required}"
    )


@pytest.mark.parametrize("name,sign", SIGN_ITEMS, ids=SIGN_IDS)
def test_self_verify_gate(name, sign):
    """The calibration self-verify gate (animated passes AND confusor rejected) is green."""
    assert self_verify(sign).passed, f"{name} failed the automated calibration gate"


# --------------------------------------------------------------------------- handshape presets
@pytest.mark.parametrize("kind", supported_shapes())
def test_preset_scores_against_its_predicate(kind):
    """Each handshape preset is recognized as its own shape (the inverse of recognition)."""
    score = handshape_confidence(Hand("Right", local_hand(kind)), kind)
    assert score >= 0.6, f"preset '{kind}' scored only {score:.2f} on its own predicate"


def test_unknown_handshape_raises():
    with pytest.raises(KeyError):
        local_hand("zzz")


# --------------------------------------------------------------------------- trajectory generators
def _traj(points, duration=1.4):
    ts = np.linspace(0.0, duration, len(points))
    return [(float(t), np.asarray(p, float)) for t, p in zip(ts, points)]


def test_linear_path_has_displacement():
    req = MovementReq(kind=MovementKind.LINEAR, min_displacement_ratio=0.3, min_duration_s=0.6)
    path = tj.linear_path((300, 250), (300 + 0.42 * 180, 250), 30)
    assert mv.linear_confidence(_traj(path), 180.0, req) > 0.9


def test_circular_path_completes_rotation():
    req = MovementReq(kind=MovementKind.CIRCULAR, min_total_rotation_deg=360.0,
                      radius_tolerance_ratio=1.0, min_duration_s=0.6)
    path = tj.circular_path_2d((300, 250), 0.13 * 180, 1.3 * 2 * np.pi, 42)
    assert mv.circular_confidence(_traj(path), 180.0, req) > 0.9


def test_oscillation_has_cycles():
    req = MovementReq(kind=MovementKind.REPEATED, min_cycles=2, min_duration_s=0.6)
    path = tj.oscillation_path((300, 250), (0, 1), 0.12 * 180, 2.5, 42)
    assert mv.repeated_confidence(_traj(path), 180.0, req) > 0.9


def test_converge_closes_gap():
    # converge_confidence now takes CLOSEST-POINT trajectories (all landmarks, not just a center) —
    # wrap each single-point path as a 1-point "hand" so the pairwise-min distance reduces to plain
    # point-to-point distance, same as the real single-point converge path being modeled here.
    # It also now requires the gap to close to near ACTUAL touch (ratio < 0.25), not just shrink by
    # some fraction of an arbitrary starting gap — gap_close_frac=0.9 lands the endpoint at ~0.06.
    req = MovementReq(kind=MovementKind.CONVERGE, min_approach_ratio=0.15, min_duration_s=0.6)
    pa, pb = tj.converge_paths((250, 250), (250 + 0.6 * 180, 250), 30, gap_close_frac=0.9)
    traj_a = _traj([[p] for p in pa])
    traj_b = _traj([[p] for p in pb])
    assert mv.converge_confidence(traj_a, traj_b, 180.0, req) > 0.7


def test_easing_is_monotonic_and_bounded():
    u = np.linspace(0, 1, 50)
    s = tj.ease_sine_in_out(u)
    assert s[0] == pytest.approx(0.0) and s[-1] == pytest.approx(1.0)
    assert np.all(np.diff(s) >= -1e-9)


# --------------------------------------------------------------------------- analytical IK
def test_ik_hits_reachable_target_exactly():
    rng = np.random.default_rng(1)
    for _ in range(200):
        s = rng.normal(size=3)
        l1, l2 = rng.uniform(0.5, 2.0), rng.uniform(0.5, 2.0)
        a = rng.normal(size=3); a /= np.linalg.norm(a)
        elbow = s + a * l1
        b = rng.normal(size=3); b /= np.linalg.norm(b)
        target = elbow + b * l2
        pose = solve_two_bone(s, target, l1, l2, pole=elbow)
        assert np.linalg.norm(pose.wrist - target) < 1e-6
        assert pose.upper_len == pytest.approx(l1, abs=1e-6)
        assert pose.fore_len == pytest.approx(l2, abs=1e-6)


def test_ik_clamps_out_of_reach():
    pose = solve_two_bone((0, 0, 0), (10, 0, 0), 1.0, 1.0, pole=(0, 1, 0))
    assert pose.clamped
    assert np.linalg.norm(pose.wrist) == pytest.approx(2.0, abs=1e-6)


# --------------------------------------------------------------------------- calibration log
def test_calibration_shippable_requires_both_gates(tmp_path):
    log = CalibrationLog(path=tmp_path / "cal.json")
    log.record_self_verify(SIGNS["COFFEE"])               # sets verifier_passed
    assert not log.get("COFFEE").shippable                # human approval still missing
    log.mark_reviewed("COFFEE", approved=True, notes="ok")
    assert log.get("COFFEE").shippable
    with pytest.raises(RuntimeError):
        log.assert_shippable("PLEASE")                     # never gated -> not shippable
    log.save()
    assert (tmp_path / "cal.json").exists()
