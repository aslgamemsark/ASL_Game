"""Shared sign definitions (pure data) — reused across all scenarios.

Import a sign directly or look it up by name in the SIGNS registry (handy for scenarios that
drive prompts by sign name). Coffee-shop signs and hospital signs all live here so both scenarios
share the same verifier without duplicating logic.
"""
from signs.coffee import COFFEE
from signs.hello import HELLO
from signs.letter_a import LETTER_A
from signs.letter_b import LETTER_B
from signs.letter_d import LETTER_D
from signs.letter_f import LETTER_F
from signs.letter_g import LETTER_G
from signs.letter_h import LETTER_H
from signs.letter_i import LETTER_I
from signs.letter_j import LETTER_J
from signs.letter_k import LETTER_K
from signs.letter_l import LETTER_L
from signs.letter_n import LETTER_N
from signs.letter_o import LETTER_O
from signs.letter_p import LETTER_P
from signs.letter_q import LETTER_Q
from signs.letter_r import LETTER_R
from signs.letter_t import LETTER_T
from signs.letter_u import LETTER_U
from signs.letter_v import LETTER_V
from signs.letter_w import LETTER_W
from signs.letter_y import LETTER_Y
from signs.letter_z import LETTER_Z
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

# Classroom scenario signs
from signs.teacher import TEACHER
from signs.write import WRITE
from signs.read import READ
from signs.name_sign import NAME
from signs.friend import FRIEND

# Hospital vocabulary, in a teaching-ish order (used by the scenario's patient queue).
HOSPITAL_SIGNS = (
    HELP, PAIN, MEDICINE, EMERGENCY,
    DOCTOR, NURSE, SICK, FEVER, WATER, BREATHE, HOSPITAL, DIZZY,
)

# Classroom vocabulary (used by that scenario's lessons).
CLASSROOM_SIGNS = (
    HELLO, PLEASE, THANK_YOU, TEACHER, WRITE, READ, NAME, FRIEND,
)

# Coffee-shop vocabulary (used by that scenario's lessons).
COFFEE_SIGNS = (
    COFFEE, PLEASE, THANK_YOU, HELLO, WANT, YES, MORE,
    LETTER_A, LETTER_B, LETTER_D, LETTER_F, LETTER_G, LETTER_H, LETTER_I, LETTER_J, LETTER_K,
    LETTER_L, LETTER_N, LETTER_O, LETTER_P, LETTER_Q, LETTER_R, LETTER_T, LETTER_U,
    LETTER_V, LETTER_W, LETTER_Y, LETTER_Z, YOU,
)

SIGNS = {s.name: s for s in (*COFFEE_SIGNS, *HOSPITAL_SIGNS, *CLASSROOM_SIGNS)}

__all__ = [
    "COFFEE", "PLEASE", "THANK_YOU", "HELLO", "WANT", "YES", "MORE",
    "LETTER_A", "LETTER_B", "LETTER_D", "LETTER_F", "LETTER_G", "LETTER_H", "LETTER_I",
    "LETTER_J", "LETTER_K", "LETTER_L", "LETTER_N", "LETTER_O", "LETTER_P", "LETTER_Q",
    "LETTER_R", "LETTER_T", "LETTER_U", "LETTER_V", "LETTER_W", "LETTER_Y", "LETTER_Z", "YOU",
    "HELP", "PAIN", "MEDICINE", "EMERGENCY",
    "DOCTOR", "NURSE", "SICK", "FEVER", "WATER", "BREATHE", "HOSPITAL", "DIZZY",
    "TEACHER", "WRITE", "READ", "NAME", "FRIEND",
    "COFFEE_SIGNS", "HOSPITAL_SIGNS", "CLASSROOM_SIGNS", "SIGNS",
]
