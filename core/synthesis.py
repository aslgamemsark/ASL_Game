"""Phase 5 — The Sign Assembly Script (schema -> animation).

This is the orchestration layer: it reads a `Sign` (the SAME declarative schema the recognition
verifier consumes) and compiles it into a playable animation — a list of timestamped `Frame`s of
synthetic landmarks. The sequence mirrors the procedural-avatar report's assembly routine:

  1. Handshape lookup   — pull each hand's canonical preset from `core.handshape_presets`.
  2. Anchor resolution  — turn the schema's Anchor into a body-relative target on a canonical rig,
                          reusing the verifier's own anchor constants so the two sides can never
                          drift apart (the report's "no bilateral error" rule).
  3. Trajectory gen     — drive the acting hand along a `core.trajectory` curve matching the
                          MovementReq (linear / circular / repeated / converge / none).
  4. Per-frame assembly — translate the handshape presets onto the per-frame hand centers, attach
                          shoulders + mouth for scale/anchor references, stamp time.

The result is intentionally re-measurable: feed the produced frames back through `core.verifier`
and the sign must pass (see `core.calibration`). The avatar pipeline targets browser Three.js; here
the same deterministic math produces 2D landmark frames that the existing Python verifier reads,
proving the schema is correct in BOTH directions before any art is built.

All distances are expressed in shoulder-widths and resolved against a canonical rig, so a clip is
independent of image size — exactly the normalization the recognition side uses.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from core import trajectory as tj
from core.handshape_presets import local_hand
from core.landmarks import Frame, Hand, PALM_POINTS, RollingBuffer
from core.schema import DOMINANT, NONDOMINANT, Anchor, MovementKind, Sign
# Reuse the verifier's body geometry so synthesis targets and recognition bands share one source.
from core.verifier import BELLY_DY, CHEST_OFFSET_RATIO, CHIN_DY

DOM_LABEL = "Right"        # synthesis convention: dominant hand is the image-Right hand
NDOM_LABEL = "Left"


# --------------------------------------------------------------------------- canonical rig
@dataclass(frozen=True)
class Body:
    """A fixed, neutral upper-body pose the trajectories anchor to (the avatar's rest skeleton)."""

    width: int = 640
    height: int = 480
    shoulder_width: float = 200.0

    @property
    def mid(self) -> np.ndarray:
        return np.array([self.width / 2.0, self.height * 0.46])

    @property
    def left_shoulder(self) -> np.ndarray:
        return self.mid + np.array([self.shoulder_width / 2.0, 0.0])

    @property
    def right_shoulder(self) -> np.ndarray:
        return self.mid - np.array([self.shoulder_width / 2.0, 0.0])

    @property
    def mouth(self) -> np.ndarray:
        return self.mid + np.array([0.0, -0.42 * self.shoulder_width])

    @property
    def hand_scale(self) -> float:
        return 0.34 * self.shoulder_width


# --------------------------------------------------------------------------- animation result
@dataclass
class Animation:
    """A compiled sign clip: timestamped synthetic frames plus the metadata to replay/score it."""

    sign_name: str
    frames: list[Frame]
    fps: float
    roles: dict = field(default_factory=dict)   # DOMINANT/NONDOMINANT -> handedness label

    @property
    def duration(self) -> float:
        return self.frames[-1].t - self.frames[0].t if len(self.frames) >= 2 else 0.0

    def buffer(self) -> RollingBuffer:
        """Pack the frames into a RollingBuffer wide enough to hold the whole clip (for verify())."""
        buf = RollingBuffer(window_seconds=self.duration + 1.0)
        for f in self.frames:
            buf.add(f)
        return buf


# --------------------------------------------------------------------------- anchor resolution
def _acting_base(sign: Sign, body: Body) -> np.ndarray:
    """Body-relative target center for the acting hand, matching the verifier's anchor geometry."""
    sw = body.shoulder_width
    mid, mouth = body.mid, body.mouth
    a = sign.location.anchor
    if a == Anchor.CHEST:
        return mid + np.array([0.0, CHEST_OFFSET_RATIO * sw])
    if a == Anchor.BELLY:
        return mid + np.array([0.0, BELLY_DY * sw])
    if a == Anchor.FOREHEAD:
        return mouth + np.array([0.0, -0.15 * sw])           # at/above the mouth = forehead/face
    if a == Anchor.CHIN:
        return mouth + np.array([0.0, CHIN_DY * sw])          # palm hangs below the chin
    if a == Anchor.SHOULDER:
        return body.right_shoulder + np.array([0.0, 0.02 * sw])
    if a == Anchor.OTHER_HAND:
        return _ndom_base(body) + _dom_offset(sign, sw)
    # NEUTRAL_SPACE — in front of the torso, below the shoulders.
    side = 0.16 if not sign.two_handed else 0.16
    return mid + np.array([side * sw, 0.45 * sw])


def _ndom_base(body: Body) -> np.ndarray:
    """Resting center of the non-dominant 'anvil' hand for OTHER_HAND signs."""
    return body.mid + np.array([-0.12 * body.shoulder_width, 0.45 * body.shoulder_width])


def _dom_offset(sign: Sign, sw: float) -> np.ndarray:
    """Offset of the dominant hand from the non-dominant one, honoring the location band/vertical."""
    loc = sign.location
    reach = min(0.26, max(loc.min_dist_ratio + 0.18, 0.5 * (loc.min_dist_ratio + loc.max_dist_ratio)))
    if loc.vertical == "above":
        return np.array([0.0, -reach * sw])
    if loc.vertical == "below":
        return np.array([0.0, reach * sw])
    return np.array([0.04 * sw, -reach * sw])                 # slightly up and over the anvil


# default linear stroke direction per anchor (image space, y down), chosen to stay within the band
_LINEAR_DIR = {
    Anchor.CHIN: np.array([0.25, 1.0]),
    Anchor.FOREHEAD: np.array([1.0, 0.0]),
    Anchor.CHEST: np.array([1.0, 0.0]),
    Anchor.BELLY: np.array([1.0, 0.0]),
    Anchor.SHOULDER: np.array([-1.0, 0.15]),
    Anchor.NEUTRAL_SPACE: np.array([0.0, 1.0]),
    Anchor.OTHER_HAND: np.array([0.0, -1.0]),
}


# --------------------------------------------------------------------------- center planning
def _plan_centers(sign: Sign, body: Body, n: int):
    """Per-frame (dom_centers[n,2], ndom_centers[n,2] | None) for the sign's movement."""
    sw = body.shoulder_width
    mv = sign.movement
    base = _acting_base(sign, body)

    ndom = None
    if sign.two_handed:
        if sign.location.anchor == Anchor.OTHER_HAND:
            ndom_base = _ndom_base(body)
        elif mv.kind == MovementKind.CONVERGE:
            ndom_base = None        # filled by converge planner
        else:
            ndom_base = base + np.array([-0.30 * sw, 0.10 * sw])

    if mv.kind == MovementKind.NONE:
        dom = np.tile(base, (n, 1))
        if sign.two_handed:
            ndom = np.tile(ndom_base, (n, 1))
        return dom, ndom

    if mv.kind == MovementKind.LINEAR:
        d = mv.direction if mv.direction is not None else _LINEAR_DIR.get(sign.location.anchor, np.array([1.0, 0.0]))
        d = np.asarray(d, float)
        d = d / (np.linalg.norm(d) or 1.0)
        amp = max(mv.min_displacement_ratio * 1.3, 0.32) * sw
        start, end = base - 0.5 * amp * d, base + 0.5 * amp * d
        dom = tj.linear_path(start, end, n)
        if sign.two_handed:
            if sign.location.anchor == Anchor.OTHER_HAND:     # platform rises with the hand (HELP)
                shift = dom - dom[0]
                ndom = ndom_base + shift
            else:                                             # both hands stroke together (WANT)
                ndom = ndom_base + (dom - dom[0])
        return dom, ndom

    if mv.kind == MovementKind.CIRCULAR:
        radius = 0.13 * sw
        total = np.radians(max(mv.min_total_rotation_deg + 60.0, 400.0))
        dom = tj.circular_path_2d(base, radius, total, n, start_angle=-np.pi / 2)
        if sign.two_handed:
            ndom = np.tile(ndom_base, (n, 1))                 # anvil stays put
        return dom, ndom

    if mv.kind == MovementKind.REPEATED:
        axis = np.array([0.0, 1.0])                           # vertical tap/nod
        amp = 0.12 * sw
        cycles = mv.min_cycles + 0.7
        dom = tj.oscillation_path(base, axis, amp, cycles, n)
        if sign.two_handed:
            if sign.location.anchor == Anchor.OTHER_HAND:
                ndom = np.tile(ndom_base, (n, 1))             # tapped-on hand stays put
            else:
                ndom = tj.oscillation_path(ndom_base, axis, amp, cycles, n)  # both move (BREATHE)
        return dom, ndom

    if mv.kind == MovementKind.CONVERGE:
        center = body.mid + np.array([0.0, 0.42 * sw])
        start_a = center + np.array([0.32 * sw, 0.0])
        start_b = center + np.array([-0.32 * sw, 0.0])
        dom, ndom = tj.converge_paths(start_a, start_b, n, gap_close_frac=0.6)
        return dom, ndom

    if mv.kind == MovementKind.TRACED:
        amp = max(mv.min_displacement_ratio * 1.2, 0.20) * sw / max(len(mv.trace_template), 1)
        dom = tj.traced_path(base, mv.trace_template, amp, n)
        return dom, None

    dom = np.tile(base, (n, 1))
    return dom, (np.tile(ndom_base, (n, 1)) if sign.two_handed else None)


# --------------------------------------------------------------------------- frame assembly
def _place_hand(kind: str, center: np.ndarray, label: str, scale: float, mirror: bool) -> Hand:
    """Build a Hand whose palm-center proxy lands exactly on `center`."""
    pts = local_hand(kind, scale=scale, mirror=mirror)
    local_center = pts[list(PALM_POINTS), :2].mean(axis=0)
    pts[:, :2] += np.asarray(center, float) - local_center
    return Hand(handedness=label, points=pts)


def synthesize(sign: Sign, fps: float = 30.0, static: bool = False,
               body: Body | None = None) -> Animation:
    """Compile a Sign into an Animation of synthetic landmark frames.

    `static=True` freezes every hand center at its time-average, removing all motion — the canonical
    confusor: a movement-required sign synthesized statically MUST fail the verifier, the synthesis
    counterpart to the original single-frame COFFEE bug.
    """
    body = body or Body()
    mv = sign.movement
    duration = 1.0 if mv.kind == MovementKind.NONE else max(1.4, mv.min_duration_s + 0.7)
    n = max(int(round(fps * duration)) + 1, 12)

    dom_c, ndom_c = _plan_centers(sign, body, n)
    if static:
        dom_c = np.tile(dom_c.mean(axis=0), (n, 1))
        if ndom_c is not None:
            ndom_c = np.tile(ndom_c.mean(axis=0), (n, 1))

    scale = body.hand_scale
    frames: list[Frame] = []
    for i in range(n):
        hands = [_place_hand(sign.dominant.kind, dom_c[i], DOM_LABEL, scale, mirror=False)]
        if sign.two_handed and ndom_c is not None:
            nd_kind = sign.nondominant.kind if sign.nondominant else sign.dominant.kind
            hands.append(_place_hand(nd_kind, ndom_c[i], NDOM_LABEL, scale, mirror=True))
        frames.append(Frame(
            t=i / fps,
            width=body.width,
            height=body.height,
            hands=hands,
            left_shoulder=body.left_shoulder.copy(),
            right_shoulder=body.right_shoulder.copy(),
            mouth=body.mouth.copy(),
        ))

    roles = {DOMINANT: DOM_LABEL}
    if sign.two_handed and ndom_c is not None:
        roles[NONDOMINANT] = NDOM_LABEL
    return Animation(sign.name, frames, fps, roles)
