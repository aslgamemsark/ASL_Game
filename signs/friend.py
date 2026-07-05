"""FRIEND — two hooked index fingers interlock and tap together, repeated.

ASL FRIEND: both hands form a hooked index-finger handshape and interlock/tap together
repeatedly (traditionally reversing direction once, simplified in v1 to a repeated tap since the
rule engine has no reversal-direction detector).

v1 simplification: the hooked-index handshape is approximated as "index" (the rule engine has no
curled-hook predicate yet, same category of approximation as WRITE's pen-hold). The REPEATED
interlocking tap is the defining, verifiable feature.

Parameters declared:
  handshape_dominant   : index (hook approximated)          [required]
  handshape_nondominant: index (hook approximated)          [required]
  location              : dominant hand touching nondominant [required]  <- tap, closest-approach
  movement               : dominant hand taps, REPEATED       [required]  <- anti-bug gate
  orientation             : not gated in v1
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

FRIEND = Sign(
    name="FRIEND",
    two_handed=True,
    # 0.5 used to sit exactly on the boundary a genuinely curled ("hook") index finger scores
    # against index_confidence (index bent halfway + rest curled = 0.5 too), so a loosely closed
    # hand read as a pass. 0.65 requires the index closer to straight, matching WRITE/FRIEND's
    # other index-gated calls.
    dominant=HandShapeReq(kind="index", required=True, min_confidence=0.65),
    nondominant=HandShapeReq(kind="index", required=True, min_confidence=0.65),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.35,
        min_dist_ratio=0.0,
        use_closest_approach=True,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        min_cycles=2,
        min_amplitude_ratio=0.05,
        min_duration_s=0.5,
        required=True,
    ),
)
