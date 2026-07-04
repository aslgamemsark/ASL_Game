"""Maps WLASL glosses -> our game sign ids. WLASL glosses are lowercase single words.

WLASL adds signer diversity on top of ASL Citizen and includes EMERGENCY (which ASL Citizen
lacked). Only exact-concept glosses are mapped — synonyms that are different lexemes (e.g.
'hurt' vs 'pain') are excluded to keep labels clean. FEVER is in neither dataset.

⚠️ WLASL is non-commercial/research-licensed — training/experiments only; verify the license
before any commercial release (see CLAUDE.md).
"""

WLASL_VOCAB: dict[str, str] = {
    "hello": "HELLO",
    "please": "PLEASE",
    "thank you": "THANK_YOU",
    "you": "YOU",
    "coffee": "COFFEE",
    "want": "WANT",
    "yes": "YES",
    "help": "HELP",
    "pain": "PAIN",
    "medicine": "MEDICINE",
    "emergency": "EMERGENCY",
    "doctor": "DOCTOR",
    "nurse": "NURSE",
    "sick": "SICK",
    "water": "WATER",
    "breathe": "BREATHE",
    "breath": "BREATHE",
    "hospital": "HOSPITAL",
    "dizzy": "DIZZY",
    "more": "MORE",
    "teacher": "TEACHER",
    "write": "WRITE",
    "read": "READ",
    "name": "NAME",
    "friend": "FRIEND",
}
