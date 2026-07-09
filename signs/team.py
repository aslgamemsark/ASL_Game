"""TEAM sign definition.

ASL TEAM (verified against Lifeprint/aslbloom — same movement family as FAMILY/GROUP/CLASS):
both hands start together in a "T" handshape, separate outward into a horizontal arc, then come
back together so the (little-finger) sides of the hands touch. This engine's movement kinds
describe a single trajectory shape (a full separate-then-rejoin arc isn't one of them), so —
matching the project's existing CONVERGE-approximation precedent (see MORE, PAIN) — only the
final closing phase is checked: both hands converging back together. A confusor that holds two
static "T" hands apart (never rejoining) must still fail on movement.

Parameters declared:
  - handshape (both hands): t (approximates the T handshape)  [required]
  - location: neutral space (loose, signed anywhere in front of the body) [not gated]
  - movement: both hands converge back together                [required]  <- anti-bug gate
"""
from core.schema import (
    DOMINANT,
    Anchor,
    HandShapeReq,
    LocationReq,
    MovementKind,
    MovementReq,
    Sign,
)

TEAM = Sign(
    name="TEAM",
    two_handed=True,
    dominant=HandShapeReq(kind="t", required=True),
    nondominant=HandShapeReq(kind="t", required=True),
    location=LocationReq(
        anchor=Anchor.NEUTRAL_SPACE,
        acting_hand=DOMINANT,
        max_dist_ratio=1.5,
        required=False,
    ),
    movement=MovementReq(
        kind=MovementKind.CONVERGE,
        actor=DOMINANT,
        min_approach_ratio=0.15,
        min_duration_s=0.4,
        required=True,
    ),
)
