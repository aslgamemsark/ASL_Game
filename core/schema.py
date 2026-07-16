"""Sign Definition Schema — every ASL sign declared as data.

A Sign is a frozen dataclass describing the five linguistic parameters (handshape per hand,
location, movement, palm orientation, non-manual markers), each carrying a `required` flag and
its own confidence threshold. The Phase 3 verifier reads a Sign + a RollingBuffer and gates the
overall pass on EACH required parameter individually — never an average. That gating is what makes
the single-frame COFFEE bug impossible to reproduce.

Structural guard against the single-frame bug (enforced in Sign.__post_init__):
movement is required IF AND ONLY IF a real movement kind is declared. You cannot construct a sign
that declares a movement but marks it not-required, or marks movement required but declares NONE.

All spatial thresholds are RATIOS of shoulder width (never raw pixels) so they hold regardless
of camera distance.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Tuple

# Roles — which physical hand a requirement refers to. The verifier maps these to detected
# Left/Right hands; the schema stays handedness-agnostic.
DOMINANT = "dominant"
NONDOMINANT = "nondominant"


# --------------------------------------------------------------------------- handshape
@dataclass(frozen=True)
class HandShapeReq:
    """Required handshape for one hand, matched by core.handshape predicates."""

    kind: str                       # "fist" / "s" / "a" / "index" / "open" / "claw"
    required: bool = True
    min_confidence: float = 0.6


# --------------------------------------------------------------------------- location
class Anchor(str, Enum):
    OTHER_HAND = "other_hand"        # position relative to the other hand's center (two-handed)
    NEUTRAL_SPACE = "neutral_space"  # anywhere in the signing space in front of the torso (loose)
    CHEST = "chest"                  # specifically the center of the chest (below the shoulders)
    CHIN = "chin"                    # the hand must REACH chin height (above shoulders) in the window
    FOREHEAD = "forehead"            # the hand reaches the face/forehead (at or above the mouth)
    BELLY = "belly"                  # the hand is low on the torso (well below the shoulder line)
    SHOULDER = "shoulder"            # the hand is near one of the shoulders (e.g. the opposite arm)


@dataclass(frozen=True)
class LocationReq:
    """Where the acting hand must be, normalized to shoulder width."""

    anchor: Anchor = Anchor.OTHER_HAND
    acting_hand: str = DOMINANT
    max_dist_ratio: float = 1.0
    min_dist_ratio: float = 0.0
    vertical: Optional[str] = None           # "above" | "below" (acting vs anchor hand) | None
    below: Optional[str] = None              # acting hand must be BELOW this body landmark: "mouth"
    use_closest_approach: bool = False       # OTHER_HAND: measure the closest POINTS of the two
                                             # hands (a tap/touch), not their palm centers
    required: bool = True
    min_confidence: float = 0.6


# --------------------------------------------------------------------------- movement
class MovementKind(str, Enum):
    NONE = "none"
    LINEAR = "linear"
    CIRCULAR = "circular"
    REPEATED = "repeated"
    CONVERGE = "converge"            # two hands closing toward each other (e.g. PAIN)
    TRACED = "traced"                # hand traces a specific path (e.g. letter J or Z in the air)


@dataclass(frozen=True)
class MovementReq:
    """How the acting hand must move over the rolling window."""

    kind: MovementKind = MovementKind.NONE
    actor: str = DOMINANT
    pivot: str = NONDOMINANT

    # circular
    min_total_rotation_deg: float = 300.0
    radius_tolerance_ratio: float = 0.4

    # linear
    direction: Optional[Tuple[float, float]] = None
    min_displacement_ratio: float = 0.3

    # repeated
    min_cycles: int = 2
    min_amplitude_ratio: float = 0.05   # min peak-to-peak swing (shoulder-widths) for a real oscillation

    # converge (PAIN): minimum shrinkage of inter-hand gap, in shoulder-widths
    min_approach_ratio: float = 0.15

    # traced (J, Z): expected direction angles for each phase of the stroke, degrees.
    # Convention: 0°=right, 90°=down (image y increases downward), 180°=left, 270°=up.
    # The trajectory is split into len(trace_template) equal time windows; each window's
    # net displacement vector must align with the corresponding angle within trace_tolerance_deg.
    trace_template: Tuple[float, ...] = ()
    trace_tolerance_deg: float = 60.0

    # linear only: when True, only frames where the acting hand already satisfies the sign's
    # location requirement count toward displacement — the reach/approach getting the hand INTO
    # position is excluded. Without this, a sign whose location is "up near the face/shoulder"
    # trivially satisfies a magnitude-only LINEAR requirement just by the hand traveling there
    # (real user reports: FEVER "passes just when I bring my hand closer to my forehead", HOSPITAL
    # "passes just by seeing my 2 fingers" — near the shoulder). Off by default; only meaningful
    # for signs whose real motion happens AT the location, not the arrival itself (FEVER, HOSPITAL).
    gate_to_location: bool = False

    # repeated (DOCTOR-style taps): the OTHER (non-acting) hand must stay relatively still, as a
    # ratio of its own path length to shoulder width over the window. Distinguishes a wrist-tap
    # (only the dominant hand moves; the wrist/forearm stays still) from clapping (both hands move
    # substantially) — a real user report found DOCTOR "passes even on clapping" because the
    # nondominant handshape isn't gated and REPEATED motion doesn't otherwise care which hand
    # moves. None disables the check.
    other_hand_max_motion_ratio: Optional[float] = None

    # shared
    min_duration_s: float = 0.6
    required: bool = True
    min_confidence: float = 0.6


# --------------------------------------------------------------------------- non-manual markers
@dataclass(frozen=True)
class NmmReq:
    """Non-manual marker requirement — a facial expression held during the sign.

    `blendshape` names one of the 52 ARKit-standard blendshapes MediaPipe Face Landmarker outputs
    (e.g. "browInnerUp" for raised eyebrows, "mouthPucker" for pursed lips). Optional/graded by
    default: no sign in the current vocabulary lexically REQUIRES a specific facial marker in
    citation form, so `required` defaults to False — this exists as coaching/scoring
    infrastructure for a future sign that genuinely needs one (e.g. a yes/no question needs raised
    eyebrows), not to bolt an invented constraint onto an existing sign.
    """

    blendshape: str
    min_score: float = 0.4
    required: bool = False
    min_confidence: float = 0.5


# --------------------------------------------------------------------------- orientation
class PalmFacing(str, Enum):
    IN = "in"
    OUT = "out"
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"


@dataclass(frozen=True)
class OrientationReq:
    """Palm-facing requirement for one hand. Off by default in v1."""

    hand: str = DOMINANT
    facing: PalmFacing = PalmFacing.DOWN
    required: bool = False
    min_confidence: float = 0.5


# --------------------------------------------------------------------------- sign
@dataclass(frozen=True)
class Sign:
    """A complete declarative description of one ASL sign."""

    name: str
    dominant: HandShapeReq
    location: LocationReq
    movement: MovementReq
    nondominant: Optional[HandShapeReq] = None
    orientation: Optional[OrientationReq] = None
    nmm: Optional[NmmReq] = None
    two_handed: bool = True

    # One-handed signs only: overrides how much the OTHER hand is allowed to move (as a ratio of
    # its own path length to shoulder width) before the "no_extra_hand" required param fails —
    # i.e. the idle hand is genuinely gesturing, not just visible at rest. None uses the global
    # default (see verifier.EXTRA_HAND_MOTION_FLOOR). EMERGENCY's vigorous single-arm shake causes
    # more natural counterbalance motion in the idle arm than a calm sign like PLEASE, so it needs
    # a looser floor.
    extra_hand_motion_floor: Optional[float] = None

    def __post_init__(self):
        has_motion = self.movement.kind != MovementKind.NONE
        if has_motion and not self.movement.required:
            raise ValueError(
                f"Sign '{self.name}': declares movement kind={self.movement.kind.value} but "
                f"movement.required=False. A declared movement must be enforced."
            )
        if self.movement.required and not has_motion:
            raise ValueError(
                f"Sign '{self.name}': movement.required=True but kind=NONE — nothing to verify."
            )
        if self.two_handed and self.nondominant is None:
            raise ValueError(
                f"Sign '{self.name}': two_handed=True but no nondominant handshape was given."
            )

    def required_parameters(self) -> list[str]:
        params: list[str] = []
        if self.dominant.required:
            params.append("handshape_dominant")
        if self.nondominant is not None and self.nondominant.required:
            params.append("handshape_nondominant")
        if self.location.required:
            params.append("location")
        if self.movement.required:
            params.append("movement")
        if self.orientation is not None and self.orientation.required:
            params.append("orientation")
        if self.nmm is not None and self.nmm.required:
            params.append("nmm")
        return params
