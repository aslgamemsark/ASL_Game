"""YELLOW sign definition.

ASL YELLOW (verified against Lifeprint/handspeak): a "Y" handshape (thumb + pinky extended, other
three fingers curled) held near the shoulder/upper chest, twisting at the wrist repeatedly. The
wrist-twist itself isn't a distinct trajectory shape this engine models (movement kinds describe
hand-CENTER trajectories, not wrist rotation) — the closest honest proxy is the same REPEATED
oscillation check used for HELLO's wave, which reads a twisting wrist as small positional jitter
over several cycles. Documented simplification, same category as HELLO.

Parameters declared:
  - handshape (dominant): y                     [required]
  - location: neutral space (upper chest area, loose) [not gated — matches HELLO/YES precedent]
  - movement: repeated (approximates wrist twist) [required]
"""
from core.schema import DOMINANT, Anchor, HandShapeReq, LocationReq, MovementKind, MovementReq, Sign

YELLOW = Sign(
    name="YELLOW",
    two_handed=False,
    dominant=HandShapeReq(kind="y", required=True),
    nondominant=None,
    location=LocationReq(anchor=Anchor.NEUTRAL_SPACE, acting_hand=DOMINANT, max_dist_ratio=3.0, required=False, min_confidence=0.45),
    movement=MovementReq(kind=MovementKind.REPEATED, actor=DOMINANT, min_cycles=2, min_duration_s=0.6, required=True, min_confidence=0.25),
)
