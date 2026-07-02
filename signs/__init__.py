"""Shared sign definitions (pure data) — reused across all scenarios.

Import a sign directly or look it up by name in the SIGNS registry (handy for scenarios that
drive prompts by sign name). Coffee-shop signs and hospital signs all live here so both scenarios
share the same verifier without duplicating logic.
"""
from signs.coffee import COFFEE
from signs.hello import HELLO
from signs.letter_a import LETTER_A
from signs.letter_b import LETTER_B
from signs.letter_l import LETTER_L
from signs.letter_v import LETTER_V
from signs.letter_y import LETTER_Y
from signs.more import MORE
from signs.please import PLEASE
from signs.thank_you import THANK_YOU
from signs.want import WANT
from signs.yes import YES
from signs.you import YOU

# Hospital scenario signs
from signs.help import HELP
from signs.pain import PAIN
from signs.medicine import MEDICINE
from signs.emergency import EMERGENCY
from signs.doctor import DOCTOR
from signs.nurse import NURSE
from signs.sick import SICK
from signs.fever import FEVER
from signs.water import WATER
from signs.breathe import BREATHE
from signs.hospital import HOSPITAL
from signs.dizzy import DIZZY

# Hospital vocabulary, in a teaching-ish order (used by the scenario's patient queue).
HOSPITAL_SIGNS = (
    HELP, PAIN, MEDICINE, EMERGENCY,
    DOCTOR, NURSE, SICK, FEVER, WATER, BREATHE, HOSPITAL, DIZZY,
)

# Coffee-shop vocabulary (used by that scenario's lessons).
COFFEE_SIGNS = (
    COFFEE, PLEASE, THANK_YOU, HELLO, WANT, YES, MORE,
    LETTER_A, LETTER_B, LETTER_L, LETTER_V, LETTER_Y, YOU,
)

SIGNS = {s.name: s for s in (*COFFEE_SIGNS, *HOSPITAL_SIGNS)}

__all__ = [
    "COFFEE", "PLEASE", "THANK_YOU", "HELLO", "WANT", "YES", "MORE",
    "LETTER_A", "LETTER_B", "LETTER_L", "LETTER_V", "LETTER_Y", "YOU",
    "HELP", "PAIN", "MEDICINE", "EMERGENCY",
    "DOCTOR", "NURSE", "SICK", "FEVER", "WATER", "BREATHE", "HOSPITAL", "DIZZY",
    "COFFEE_SIGNS", "HOSPITAL_SIGNS", "SIGNS",
]
