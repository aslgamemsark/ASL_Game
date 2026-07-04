"""NAME — two crossed H-handshape hands tap together, repeated.

ASL NAME: both hands form the H/U handshape (index + middle extended together) and the dominant
hand taps twice against the crossed nondominant hand. The repeated tap is the defining feature.

v1 note: the H/U/N handshape pattern in core/handshape.py is geometrically identical across all
three letters (no orientation modeling), so this reuse is only safe here because NAME is a
two-handed sign with a REQUIRED repeated tap — the movement (not the handshape alone) carries the
real discrimination, the same accepted precedent as NURSE/HOSPITAL. It would NOT be safe to reuse
this pattern for a static, movement-less fingerspelling letter (see LETTER_W/LETTER_I — H/N/U were
deliberately NOT added as letters for exactly this reason).

Parameters declared:
  handshape_dominant   : H/U (index + middle extended)      [required]
  handshape_nondominant: H/U (index + middle extended)      [required]
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

NAME = Sign(
    name="NAME",
    two_handed=True,
    dominant=HandShapeReq(kind="h", required=True, min_confidence=0.5),
    nondominant=HandShapeReq(kind="h", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        max_dist_ratio=0.4,
        min_dist_ratio=0.0,
        use_closest_approach=True,
        required=True,
    ),
    movement=MovementReq(
        kind=MovementKind.REPEATED,
        actor=DOMINANT,
        min_cycles=2,
        min_amplitude_ratio=0.04,
        min_duration_s=0.4,
        required=True,
    ),
)
