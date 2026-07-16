"""Generic temporal verifier — one engine for every sign.

verify(buffer, sign) returns a per-parameter breakdown PLUS an overall pass/fail. The overall
pass requires EVERY parameter marked required to individually clear its own threshold. There is
no averaging: a perfect handshape can never compensate for absent required movement.

Role assignment: the hand that moved more across the window is DOMINANT; the stiller one is
NONDOMINANT. This is handedness-agnostic and works for signs like COFFEE (one hand acts, one
holds) and HELP (both rise, dominant tracks the higher-motion A-hand on top).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from core import handshape as hs
from core import movement as mv
from core import orientation as ori
from core.landmarks import RollingBuffer, normalized_distance
from core.schema import DOMINANT, NONDOMINANT, Anchor, MovementKind, Sign

SMOOTH_SECONDS = 0.5

# Anchor.CHEST geometry, in shoulder-widths below the shoulder line.
# The hand must be at chest HEIGHT: full credit within +-CHEST_VBAND of CHEST_OFFSET_RATIO,
# then a linear falloff over CHEST_VFALL. Tuned so the pass/fail boundary lands at ~dy 0.6:
# chest reads dy <= 0.6 (full credit up to 0.60), belly reads dy > 0.6 and fails.
CHEST_OFFSET_RATIO = 0.35
CHEST_VBAND = 0.25
CHEST_VFALL = 0.12

# Anchor.CHIN, measured against the REAL mouth landmark (robust to camera/proportions).
# When the fingertips touch the chin, the PALM CENTER (what we track) sits ~CHIN_DY shoulder-
# widths BELOW the mouth (the palm hangs below the fingertips). Full credit within +-CHIN_DY_BAND,
# linear falloff over CHIN_DY_FALL. This vertical band uniquely picks the chin and rejects the
# nose/face (palm ~at the mouth), the head (palm above the mouth), and the chest (palm too low).
CHIN_DY = 0.45
CHIN_DY_BAND = 0.18
CHIN_DY_FALL = 0.17

# Anchor.FOREHEAD — the palm is up at the face/forehead: at or above the mouth landmark. Full
# credit for any palm at-or-above the mouth (dy <= FOREHEAD_DY_MAX), falloff once it drops to the
# chest/neck. Picks the forehead/face region and rejects chest/belly hands.
FOREHEAD_DY_MAX = 0.15
FOREHEAD_DY_FALL = 0.30

# Anchor.BELLY — the palm is low on the torso, ~0.9 shoulder-widths below the shoulder line.
BELLY_DY = 0.90
BELLY_DY_BAND = 0.30
BELLY_DY_FALL = 0.25

# Anchor.SHOULDER — the palm is near one of the shoulders (e.g. the opposite upper arm).
SHOULDER_FALL = 0.30


@dataclass
class ParamScore:
    name: str
    score: float
    threshold: float
    required: bool

    @property
    def cleared(self) -> bool:
        return self.score >= self.threshold

    @property
    def passed(self) -> bool:
        return (not self.required) or self.cleared


@dataclass
class VerifyResult:
    sign_name: str
    params: list[ParamScore]
    roles: dict

    @property
    def passed(self) -> bool:
        required = [p for p in self.params if p.required]
        return len(required) > 0 and all(p.passed for p in required)

    @property
    def failing_required(self) -> list[str]:
        return [p.name for p in self.params if p.required and not p.cleared]

    def get(self, name: str) -> ParamScore | None:
        for p in self.params:
            if p.name == name:
                return p
        return None


# ------------------------------------------------------------------ trajectory helpers
def _trajectory(buffer: RollingBuffer, handedness: str | None):
    if handedness is None:
        return []
    out = []
    for f in buffer:
        h = f.hand(handedness)
        if h is not None:
            out.append((f.t, h.center))
    return out


def _aligned_pair_points(buffer: RollingBuffer, label_a: str, label_b: str):
    """Frame-aligned (t, all 21 landmark points) pairs for two hands, for CONVERGE's
    closest-fingertip distance — palm CENTERS never get very close even when fingertips touch."""
    traj_a, traj_b = [], []
    for f in buffer:
        ha, hb = f.hand(label_a), f.hand(label_b)
        if ha is not None and hb is not None:
            traj_a.append((f.t, ha.points[:, :2]))
            traj_b.append((f.t, hb.points[:, :2]))
    return traj_a, traj_b


def _path_length(traj) -> float:
    if len(traj) < 2:
        return 0.0
    pts = np.array([c for _, c in traj], dtype=float)
    return float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))


def assign_roles(buffer: RollingBuffer) -> dict:
    """Map DOMINANT/NONDOMINANT to detected handedness labels by relative motion."""
    labels: list[str] = []
    for f in buffer:
        for h in f.hands:
            if h.handedness not in labels:
                labels.append(h.handedness)
    if not labels:
        return {}
    if len(labels) == 1:
        return {DOMINANT: labels[0]}
    labels.sort(key=lambda lab: _path_length(_trajectory(buffer, lab)), reverse=True)
    return {DOMINANT: labels[0], NONDOMINANT: labels[1]}


def _recent(buffer: RollingBuffer, seconds: float):
    frames = list(buffer)
    if not frames:
        return []
    end_t = frames[-1].t
    return [f for f in frames if end_t - f.t <= seconds]


def _latest_shoulder_width(buffer: RollingBuffer):
    for f in reversed(list(buffer)):
        if f.shoulder_width:
            return f.shoulder_width
    return None


# ------------------------------------------------------------------ parameter scorers
def _score_handshape(buffer, handedness, kind) -> float:
    vals = []
    for f in _recent(buffer, SMOOTH_SECONDS):
        h = f.hand(handedness)
        if h is not None:
            vals.append(hs.handshape_confidence(h, kind))
    return float(np.median(vals)) if vals else 0.0


def _best_fit_roles(buffer, sign: Sign, roles: dict) -> dict:
    """Stabilize dominant/nondominant for two-handed signs with DIFFERENT handshapes.

    assign_roles() picks the dominant hand by which one moved more — perfect for signs where one
    hand acts and one holds (COFFEE), but unstable for signs where BOTH hands move together (HELP:
    fist + open palm both lift). There the role labels flicker frame-to-frame, so the two handshape
    scores keep swapping 1.0<->0.0 and never line up. When the two declared handshapes differ, we
    instead keep whichever role assignment best FITS the declared shapes. Symmetric signs (COFFEE =
    fist+fist) and one-handed signs are left exactly as assign_roles returned them.
    """
    if not sign.two_handed or sign.nondominant is None:
        return roles
    if sign.dominant.kind == sign.nondominant.kind:
        return roles
    dl, nl = roles.get(DOMINANT), roles.get(NONDOMINANT)
    if dl is None or nl is None:
        return roles
    dk, nk = sign.dominant.kind, sign.nondominant.kind
    current = min(_score_handshape(buffer, dl, dk), _score_handshape(buffer, nl, nk))
    swapped = min(_score_handshape(buffer, nl, dk), _score_handshape(buffer, dl, nk))
    if swapped > current:
        return {DOMINANT: nl, NONDOMINANT: dl}
    return roles


def _score_location(buffer, sign: Sign, roles, shoulder_width) -> float:
    if shoulder_width is None:
        return 0.0
    loc = sign.location
    acting_label = roles.get(loc.acting_hand)
    if acting_label is None:
        return 0.0

    if loc.anchor == Anchor.CHIN:
        return _score_chin_reach(buffer, acting_label, shoulder_width, loc)

    vals = []
    for f in _recent(buffer, SMOOTH_SECONDS):
        acting = f.hand(acting_label)
        if acting is None:
            continue

        if loc.anchor == Anchor.OTHER_HAND:
            other_role = NONDOMINANT if loc.acting_hand == DOMINANT else DOMINANT
            other_label = roles.get(other_role)
            other = f.hand(other_label) if other_label else None
            if other is None:
                continue
            if loc.use_closest_approach:
                # closest points of the two hands — a tap/touch brings a fingertip up to the other
                # hand even though the palm CENTRES stay far apart (a wrist-tap is ~1 shoulder-width
                # centre-to-centre but near-zero at the contact point).
                ap, op = acting.points[:, :2], other.points[:, :2]
                d = float(np.min(np.linalg.norm(ap[:, None, :] - op[None, :, :], axis=2))) / shoulder_width
            else:
                d = normalized_distance(acting.center, other.center, shoulder_width)
            dist_score = _band_score(d, loc.min_dist_ratio, loc.max_dist_ratio)
            vert_score = _vertical_score(loc.vertical, acting.center, other.center, shoulder_width)
            score = min(dist_score, vert_score)
            # Optional body-height gate: e.g. DOCTOR/NURSE tap on the forearm in the TORSO, so the
            # hands must be BELOW the mouth — tapping up at the face must not count.
            if loc.below == "mouth" and f.mouth is not None:
                dy = (acting.center[1] - f.mouth[1]) / shoulder_width   # +ve = below the mouth
                score *= float(np.clip((dy + 0.1) / 0.3, 0.0, 1.0))     # 0 at/above the face
            vals.append(score)
        elif loc.anchor == Anchor.CHEST:
            if f.left_shoulder is None or f.right_shoulder is None:
                continue
            mid = (f.left_shoulder + f.right_shoulder) / 2.0
            dx = abs(acting.center[0] - mid[0]) / shoulder_width      # sideways from center
            dy = (acting.center[1] - mid[1]) / shoulder_width         # below the shoulder line
            v = 1.0 - max(0.0, abs(dy - CHEST_OFFSET_RATIO) - CHEST_VBAND) / CHEST_VFALL
            h = 1.0 - max(0.0, dx - loc.max_dist_ratio) / 0.35
            vals.append(float(np.clip(min(v, h), 0.0, 1.0)))

        elif loc.anchor == Anchor.FOREHEAD:
            if f.mouth is None:
                continue
            dx = abs(acting.center[0] - f.mouth[0]) / shoulder_width
            dy = (acting.center[1] - f.mouth[1]) / shoulder_width     # +ve = palm below the mouth
            v = 1.0 - max(0.0, dy - FOREHEAD_DY_MAX) / FOREHEAD_DY_FALL  # at/above mouth = full credit
            h = 1.0 - max(0.0, dx - loc.max_dist_ratio) / 0.4
            vals.append(float(np.clip(min(v, h), 0.0, 1.0)))

        elif loc.anchor == Anchor.BELLY:
            if f.left_shoulder is None or f.right_shoulder is None:
                continue
            mid = (f.left_shoulder + f.right_shoulder) / 2.0
            dx = abs(acting.center[0] - mid[0]) / shoulder_width
            dy = (acting.center[1] - mid[1]) / shoulder_width
            v = 1.0 - max(0.0, abs(dy - BELLY_DY) - BELLY_DY_BAND) / BELLY_DY_FALL
            h = 1.0 - max(0.0, dx - loc.max_dist_ratio) / 0.4
            vals.append(float(np.clip(min(v, h), 0.0, 1.0)))

        elif loc.anchor == Anchor.SHOULDER:
            if f.left_shoulder is None or f.right_shoulder is None:
                continue
            d = min(
                float(np.linalg.norm(acting.center - f.left_shoulder)),
                float(np.linalg.norm(acting.center - f.right_shoulder)),
            ) / shoulder_width
            vals.append(float(np.clip(1.0 - max(0.0, d - loc.max_dist_ratio) / SHOULDER_FALL, 0.0, 1.0)))

        else:  # NEUTRAL_SPACE — anywhere in front of the torso, below the shoulders (loose)
            if f.left_shoulder is None or f.right_shoulder is None:
                continue
            mid = (f.left_shoulder + f.right_shoulder) / 2.0
            d = normalized_distance(acting.center, mid, shoulder_width)
            dist_score = _band_score(d, 0.0, loc.max_dist_ratio)
            below = acting.center[1] > mid[1]
            vals.append(dist_score if below else dist_score * 0.5)

    return float(np.median(vals)) if vals else 0.0


def _band_score(d: float, lo: float, hi: float) -> float:
    """1.0 inside [lo, hi]; falls off smoothly outside."""
    if lo <= d <= hi:
        return 1.0
    span = max(hi - lo, hi, 1e-6)
    if d < lo:
        return float(np.clip(1.0 - (lo - d) / span, 0.0, 1.0))
    return float(np.clip(1.0 - (d - hi) / span, 0.0, 1.0))


def _vertical_score(vertical, acting_c, other_c, shoulder_width) -> float:
    """Graded vertical preference, normalized to shoulder width.

    For "above": full credit when the acting hand is level-or-above the anchor; only penalized
    when it drops CLEARLY below (a soft ramp to 0 over ~1/3 shoulder width). This avoids the old
    binary flip that snapped location to 0 every time a grinding hand dipped to the same height.
    """
    if vertical is None:
        return 1.0
    # dy > 0 when the acting hand is ABOVE the anchor (image y grows downward)
    dy = (other_c[1] - acting_c[1]) / max(shoulder_width, 1e-6)
    ramp = 0.33  # how far below (in shoulder-widths) drives the score to 0
    if vertical == "above":
        return 1.0 if dy >= 0 else float(np.clip(1.0 + dy / ramp, 0.0, 1.0))
    if vertical == "below":
        return 1.0 if dy <= 0 else float(np.clip(1.0 - dy / ramp, 0.0, 1.0))
    return 1.0


def _score_chin_reach(buffer, acting_label, shoulder_width, loc) -> float:
    """Score whether the acting hand reached the chin, against the REAL mouth landmark.

    Robust to camera angle/distance and proportions: we compare the hand to the detected mouth,
    not a guessed offset. Take the hand's CLOSEST approach to the mouth among frames where the
    hand is at-or-below mouth height (frames well ABOVE the mouth are forehead/head, not chin, and
    are excluded). A hand that stays down at the chest never gets near the mouth, so it scores ~0.
    """
    best = 0.0
    for f in buffer:
        h = f.hand(acting_label)
        if h is None or f.mouth is None:
            continue
        dx = abs(h.center[0] - f.mouth[0]) / shoulder_width
        dy = (h.center[1] - f.mouth[1]) / shoulder_width    # +ve = palm below the mouth (the chin)
        vert = 1.0 - max(0.0, abs(dy - CHIN_DY) - CHIN_DY_BAND) / CHIN_DY_FALL
        horiz = 1.0 - max(0.0, dx - loc.max_dist_ratio) / 0.35
        best = max(best, min(vert, horiz))                  # best (closest) approach over the window
    return float(np.clip(best, 0.0, 1.0))


def _frame_at_location(f, sign: Sign, acting_label: str, shoulder_width: float) -> float:
    """Lightweight per-frame 'is the acting hand already at the sign's required location' score,
    for the FOREHEAD/SHOULDER anchors — used only to gate LINEAR movement scoring to the
    post-arrival portion of the trajectory (see MovementReq.gate_to_location). Deliberately
    duplicates a slice of _score_location's per-anchor math rather than refactoring it, so this
    stays additive and can't regress the existing (already-tuned) aggregate location scorer.
    """
    loc = sign.location
    h = f.hand(acting_label)
    if h is None:
        return 0.0
    if loc.anchor == Anchor.FOREHEAD:
        if f.mouth is None:
            return 0.0
        dx = abs(h.center[0] - f.mouth[0]) / shoulder_width
        dy = (h.center[1] - f.mouth[1]) / shoulder_width
        v = 1.0 - max(0.0, dy - FOREHEAD_DY_MAX) / FOREHEAD_DY_FALL
        hscore = 1.0 - max(0.0, dx - loc.max_dist_ratio) / 0.4
        return float(np.clip(min(v, hscore), 0.0, 1.0))
    if loc.anchor == Anchor.SHOULDER:
        if f.left_shoulder is None or f.right_shoulder is None:
            return 0.0
        d = min(
            float(np.linalg.norm(h.center - f.left_shoulder)),
            float(np.linalg.norm(h.center - f.right_shoulder)),
        ) / shoulder_width
        return float(np.clip(1.0 - max(0.0, d - loc.max_dist_ratio) / SHOULDER_FALL, 0.0, 1.0))
    return 1.0  # anchors without a gating implementation: no filtering


def _gated_trajectory(buffer, sign: Sign, actor_label: str, shoulder_width: float):
    """The actor's trajectory restricted to frames where it already satisfies the sign's
    location — excludes the reach/approach phase from LINEAR movement scoring. Without this, a
    sign whose real motion happens AT a location (FEVER's brow sweep, HOSPITAL's shoulder cross)
    trivially satisfies a magnitude-only LINEAR check just by the hand traveling there."""
    out = []
    for f in buffer:
        h = f.hand(actor_label)
        if h is None:
            continue
        if _frame_at_location(f, sign, actor_label, shoulder_width) >= 0.5:
            out.append((f.t, h.center))
    return out


def _score_movement(buffer, sign: Sign, roles, shoulder_width) -> float:
    req = sign.movement
    if req.kind == MovementKind.NONE:
        return 1.0
    actor_label = roles.get(req.actor)
    actor_traj = _trajectory(buffer, actor_label)
    if shoulder_width is None or not actor_traj:
        return 0.0
    if req.kind == MovementKind.CONVERGE:
        # Two-hand movement: need aligned trajectories for both hands.
        ndom_label = roles.get(NONDOMINANT)
        if ndom_label is None:
            return 0.0
        traj_a, traj_b = _aligned_pair_points(buffer, actor_label, ndom_label)
        return mv.converge_confidence(traj_a, traj_b, shoulder_width, req)

    if req.kind == MovementKind.LINEAR and req.gate_to_location:
        actor_traj = _gated_trajectory(buffer, sign, actor_label, shoulder_width)
        if not actor_traj:
            return 0.0

    score = mv.movement_confidence(actor_traj, shoulder_width, req)

    if req.other_hand_max_motion_ratio is not None:
        other_label = roles.get(NONDOMINANT)
        other_ratio = _path_length(_trajectory(buffer, other_label)) / shoulder_width
        stillness = float(np.clip(1.0 - other_ratio / req.other_hand_max_motion_ratio, 0.0, 1.0))
        score = min(score, stillness)

    return score


def _score_orientation(buffer, sign: Sign, roles) -> float:
    o = sign.orientation
    label = roles.get(o.hand)
    if label is None:
        return 0.0
    vals = []
    for f in _recent(buffer, SMOOTH_SECONDS):
        h = f.hand(label)
        if h is not None:
            vals.append(ori.facing_confidence(h, o.facing))
    return float(np.median(vals)) if vals else 0.0


# One-handed signs only. A hand merely VISIBLE at rest (common webcam framing — most signers
# don't hide their idle hand off-screen) shouldn't fail a sign; a hand that's independently
# GESTURING is the real confusor this guards against (production bug report 2026-07-14: PLEASE/
# THANK_YOU passed even with the idle hand actively signing something else in frame). Path length
# of the other hand's own trajectory, not mere presence, is what actually distinguishes the two.
EXTRA_HAND_TOLERANCE = 0.8
EXTRA_HAND_MOTION_FLOOR = 0.30  # shoulder-widths of path length = "actively gesturing"


def _score_no_extra_hand(buffer, sign: Sign, roles, shoulder_width) -> float:
    dom_label = roles.get(DOMINANT)
    frames = _recent(buffer, SMOOTH_SECONDS)
    if dom_label is None or not frames or shoulder_width is None:
        return 1.0  # nothing to judge yet — don't false-fail
    other_labels: set[str] = set()
    for f in frames:
        for h in f.hands:
            if h.handedness != dom_label:
                other_labels.add(h.handedness)
    if not other_labels:
        return 1.0
    floor = sign.extra_hand_motion_floor if sign.extra_hand_motion_floor is not None else EXTRA_HAND_MOTION_FLOOR
    max_motion = max(_path_length(_trajectory(buffer, label)) for label in other_labels)
    motion_ratio = max_motion / shoulder_width
    return float(np.clip(1.0 - motion_ratio / floor, 0.0, 1.0))


def _score_nmm(buffer, sign: Sign) -> float:
    """Score a facial blendshape held over the recent window (median-smoothed), same convention
    as every other scorer here: frames with no data are excluded, and an empty window scores 0.0.
    Every current NMM requirement is `required=False`, so a 0.0 here (e.g. face capture wasn't
    enabled this session) never gates `passed` — it only affects a graded/coaching score.
    """
    n = sign.nmm
    vals = []
    for f in _recent(buffer, SMOOTH_SECONDS):
        if f.face_blendshapes is not None:
            vals.append(float(np.clip(f.face_blendshapes.get(n.blendshape, 0.0) / max(n.min_score, 1e-6), 0.0, 1.0)))
    return float(np.median(vals)) if vals else 0.0


# ------------------------------------------------------------------ public API
def movement_debug(buffer: RollingBuffer, sign: Sign) -> str:
    """One-line readout of live movement sub-metrics for the dev demo / calibration."""
    req = sign.movement
    if req.kind == MovementKind.NONE:
        return "static (no movement required)"
    roles = assign_roles(buffer)
    sw = _latest_shoulder_width(buffer)
    traj = _trajectory(buffer, roles.get(req.actor))
    if req.kind == MovementKind.CIRCULAR:
        m = mv.circular_metrics(traj, sw if sw else 0.0, req)
        return (f"rot {m.net_rotation_deg:3.0f}/{req.min_total_rotation_deg:.0f}deg  "
                f"radCV {m.radius_cv:0.2f}(full<0.30)  r/sw {m.mean_r_ratio:0.2f}  "
                f"frames {m.n}  {m.duration:0.1f}s")
    if req.kind == MovementKind.CONVERGE:
        ndom_label = roles.get(NONDOMINANT)
        if ndom_label and sw:
            traj_a, traj_b = _aligned_pair_points(buffer, roles.get(req.actor), ndom_label)
            n = min(len(traj_a), len(traj_b))
            if n >= 2:
                gap = np.array([
                    float(np.min(np.linalg.norm(traj_a[i][1][:, None, :] - traj_b[i][1][None, :, :], axis=2))) / sw
                    for i in range(n)
                ])
                return f"converge: closest {gap.max():.2f}->{gap[-1]:.2f}sw (min {gap.min():.2f})  n={n}"
        return "converge: waiting for both hands"
    return f"{req.kind.value}: {len(traj)} samples"


def location_debug(buffer: RollingBuffer, sign: Sign) -> str:
    """One-line readout of the acting hand's position vs the shoulders, for calibration.

    dy = shoulder-widths BELOW the shoulder line, dx = shoulder-widths SIDEWAYS from center.
    For a CHEST sign it also shows the target band so you can see where chest ends / belly begins.
    """
    loc = sign.location
    roles = assign_roles(buffer)
    sw = _latest_shoulder_width(buffer)
    label = roles.get(loc.acting_hand)
    for f in reversed(_recent(buffer, SMOOTH_SECONDS)):
        h = f.hand(label) if label else None
        if h is not None and f.left_shoulder is not None and sw:
            mid = (f.left_shoulder + f.right_shoulder) / 2.0
            dx = abs(h.center[0] - mid[0]) / sw
            dy = (h.center[1] - mid[1]) / sw
            if loc.anchor == Anchor.CHEST:
                lo, hi = CHEST_OFFSET_RATIO - CHEST_VBAND, CHEST_OFFSET_RATIO + CHEST_VBAND
                return f"loc dy {dy:.2f} (chest band {lo:.2f}-{hi:.2f})  dx {dx:.2f}"
            if loc.anchor == Anchor.CHIN:
                dys = [(g.hand(label).center[1] - g.mouth[1]) / sw
                       for g in buffer if g.hand(label) is not None and g.mouth is not None]
                best_dy = min(dys, key=lambda v: abs(v - CHIN_DY)) if dys else dy
                return f"loc palm-vs-mouth dy {best_dy:+.2f} (chin ~ +{CHIN_DY:.2f})  now dy {dy:+.2f}"
            return f"loc dy {dy:.2f}  dx {dx:.2f}  anchor={loc.anchor.value}"
    return "loc: (acting hand or shoulders not visible)"


def verify(buffer: RollingBuffer, sign: Sign) -> VerifyResult:
    roles = _best_fit_roles(buffer, sign, assign_roles(buffer))
    sw = _latest_shoulder_width(buffer)
    params: list[ParamScore] = []

    dom = sign.dominant
    params.append(ParamScore(
        "handshape_dominant",
        _score_handshape(buffer, roles.get(DOMINANT), dom.kind),
        dom.min_confidence, dom.required,
    ))

    if sign.nondominant is not None:
        nd = sign.nondominant
        params.append(ParamScore(
            "handshape_nondominant",
            _score_handshape(buffer, roles.get(NONDOMINANT), nd.kind),
            nd.min_confidence, nd.required,
        ))
    else:
        params.append(ParamScore(
            "no_extra_hand",
            _score_no_extra_hand(buffer, sign, roles, sw),
            EXTRA_HAND_TOLERANCE, True,
        ))

    params.append(ParamScore(
        "location",
        _score_location(buffer, sign, roles, sw),
        sign.location.min_confidence, sign.location.required,
    ))

    params.append(ParamScore(
        "movement",
        _score_movement(buffer, sign, roles, sw),
        sign.movement.min_confidence, sign.movement.required,
    ))

    if sign.orientation is not None:
        params.append(ParamScore(
            "orientation",
            _score_orientation(buffer, sign, roles),
            sign.orientation.min_confidence, sign.orientation.required,
        ))

    if sign.nmm is not None:
        params.append(ParamScore(
            "nmm",
            _score_nmm(buffer, sign),
            sign.nmm.min_confidence, sign.nmm.required,
        ))

    return VerifyResult(sign.name, params, roles)
