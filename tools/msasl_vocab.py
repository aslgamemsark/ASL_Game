"""Maps MS-ASL `clean_text` glosses -> our game sign ids. MS-ASL glosses are lowercase,
already-cleaned single words/phrases (see MSASL_classes.json).

MS-ASL ships metadata only (YouTube URL + start/end time in seconds per instance); videos must be
fetched separately. Same "expect partial yield, some links dead" situation as WLASL (dataset is
from 2019). PAIN and BREATHE have no matching MS-ASL entries — covered by ASL Citizen/WLASL only.

⚠️ MS-ASL is C-UDA licensed (Computational Use of Data Agreement) — training/research use; verify
terms before any commercial release (see CLAUDE.md's licensing checklist).
"""

MSASL_VOCAB: dict[str, str] = {
    "hello": "HELLO",
    "please": "PLEASE",
    "thank you": "THANK_YOU",
    "you": "YOU",
    "coffee": "COFFEE",
    "want": "WANT",
    "yes": "YES",
    "help": "HELP",
    "medicine": "MEDICINE",
    "emergency": "EMERGENCY",
    "doctor": "DOCTOR",
    "nurse": "NURSE",
    "sick": "SICK",
    "water": "WATER",
    "hospital": "HOSPITAL",
    "dizzy": "DIZZY",
    "more": "MORE",
    "teacher": "TEACHER",
    "write": "WRITE",
    "read": "READ",
    "name": "NAME",
    "friend": "FRIEND",
}
