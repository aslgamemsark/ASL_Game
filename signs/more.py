"""MORE — both hands in a flattened-O/claw shape, fingertips brought together.

ASL MORE (verified against Lifeprint): both hands form a "flattened O" handshape — this engine's
"claw" predicate (fingers curled but not fully closed) is the closest existing match — held apart
in front of the body, then brought together so the fingertips meet. The verifiable feature for
rule-based v1 is the CONVERGENCE of the two hands, same mechanism as PAIN: holding two motionless
claw hands apart is a plausible-looking static confusor that must still fail on movement.

Parameters declared:
  handshape_dominant   : claw (flattened-O approximation)   [required]
  handshape_nondominant: claw (flattened-O approximation)   [required]
  location              : neutral space                     [not gated — signed anywhere in front of the body]
  movement              : both hands CONVERGE                [required]  <- anti-bug gate
  orientation            : not gated in v1
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

MORE = Sign(
    name="MORE",
    two_handed=True,
    # claw's floor (mean curl > 0.25) is tuned for MEDICINE/EMERGENCY's deeper bent-5; a real
    # flattened-O MORE take measured mean curl ~0.10-0.17, which claw reads as exactly 0. flat_o has
    # its own, much lower floor calibrated against that real recording.
    dominant=HandShapeReq(kind="flat_o", required=True, min_confidence=0.4),
    nondominant=HandShapeReq(kind="flat_o", required=True, min_confidence=0.4),
    location=LocationReq(
        anchor=Anchor.NEUTRAL_SPACE,
        acting_hand=DOMINANT,
        max_dist_ratio=1.5,
        required=False,            # MORE is signed anywhere in front of the body
    ),
    movement=MovementReq(
        kind=MovementKind.CONVERGE,
        actor=DOMINANT,
        min_approach_ratio=0.15,   # gap must close by ~0.15 shoulder widths, same as PAIN
        # Investigated 2026-07-14 against a real webcam rapid/random-movement confusor: two hands
        # waved fast and randomly near each other closed gap by MORE than the real MORE sign's own
        # deliberate convergence (rapid median approach 0.558 shoulder-widths vs. correct's 0.497) —
        # frantic motion crosses paths by chance at least as often as a controlled convergence.
        # Raising min_approach_ratio to reject that would fail correct MORE first, not rapid.
        # min_confidence values up to 1.0 don't separate them either (a real recorded rapid confusor
        # sustained a false PASS at every threshold that still let correct pass). The web app's
        # trained classifier gate (knownSigns includes MORE) is the real backstop here until this
        # check tracks more than gap distance.
        min_duration_s=0.4,
        required=True,
    ),
)
