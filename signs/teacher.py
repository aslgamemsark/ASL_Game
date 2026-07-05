"""TEACHER — both hands at the temples, moving outward/forward, repeated.

ASL TEACHER: both hands start near the temples in a flat-O handshape and move outward/forward
twice (the "throwing knowledge outward" root also used for EXPLAIN/LECTURE-family signs).

v1 simplification: flat-O is approximated as "open" (the same approximation COFFEE makes for the
S-hand as "fist" — the rule engine doesn't yet model a curled-O shape). The REPEATED outward
movement near the head is what actually distinguishes TEACHER from any other classroom sign, so
the handshape only needs to confirm "a hand, not a fist," matching MEDICINE/EMERGENCY's own stated
philosophy that movement carries the discriminating weight.

Parameters declared:
  handshape_dominant   : open hand (flat-O approximated)   [required]
  handshape_nondominant: open hand (flat-O approximated)   [required]
  location              : dominant hand at/near the forehead [required]
  movement               : dominant hand moves outward, REPEATED [required]  <- anti-bug gate
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

TEACHER = Sign(
    name="TEACHER",
    two_handed=True,
    dominant=HandShapeReq(kind="open", required=True, min_confidence=0.5),
    nondominant=HandShapeReq(kind="open", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.FOREHEAD,
        acting_hand=DOMINANT,
        max_dist_ratio=0.8,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        # min_cycles=1 was tried and reverted: a live test found that simply HOLDING two hands
        # still near the forehead (no signing at all) could score ~1 cycle from natural tracking
        # jitter alone, since near-face hand tracking is noisy enough that amplitude doesn't
        # reliably distinguish real motion from tremor here. Requiring 2 full cycles means an
        # attempt sometimes needs a retry to register at the app's 2.0s window, but that is a far
        # safer failure mode than passing on zero real movement.
        min_cycles=2,
        min_amplitude_ratio=0.08,
        min_duration_s=0.5,
        required=True,
    ),
)
