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
    # A real recorded take measured the TAPPING (dominant) hand's fingers naturally curling
    # somewhat on contact — the still nondominant hand holds a clean H (0.84) while the moving one
    # only reached ~0.33 against the old 0.5 floor. The wrong-shape confusor scores 0.0 (huge
    # margin), so 0.3 still rejects a genuinely different handshape while tolerating in-motion blur.
    # Only the DOMINANT (moving) hand gets this tolerance — a live test found that loosening
    # nondominant too let it hold almost any shape, since that hand never has to move at all and so
    # never has an in-motion-blur excuse. It stays at the original, stricter 0.5.
    dominant=HandShapeReq(kind="h", required=True, min_confidence=0.3),
    nondominant=HandShapeReq(kind="h", required=True, min_confidence=0.5),
    location=LocationReq(
        anchor=Anchor.OTHER_HAND,
        acting_hand=DOMINANT,
        # 0.4 gave FULL credit to hands merely hovering close (up to 40% of shoulder width apart) —
        # a live test found a real double-tap could pass without ever actually touching the other
        # hand. A real recorded tap measured closest-approach down to ~0.01-0.06; 0.15 still clears
        # genuine contact with margin while rejecting a near-miss hover.
        max_dist_ratio=0.15,
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
