---
type: moc
---

# Code Map — Signs (the data layer)

Every sign is declared as **data**, not code-with-logic — this is what makes [[Code-Map-Recognition-Engine]]
a single generic function instead of one hand-written checker per sign.

## Where signs live
- Python: `signs/*.py` — one file per sign (e.g. `signs/coffee.py`), built from
  `core.schema.Sign` + its sub-requirements (`HandShapeReq`, `LocationReq`, `MovementReq`,
  `OrientationReq`, `NmmReq`). `signs/__init__.py` is the registry (`SIGNS: dict[str, Sign]`) and
  groups signs into `COFFEE_SIGNS` / `HOSPITAL_SIGNS` / `CLASSROOM_SIGNS` per [[Scenarios]].
- TypeScript mirror: `web/src/engine/signs/index.ts` — same signs, built via `createSign({...})`
  from `web/src/engine/schema.ts`. This is the registry `PracticePage`/`LessonPage` actually import
  as `ENGINE_SIGNS` to drive live recognition (see [[Code-Map-Web-App]]).
- **Separate, cosmetic-only data**: `web/src/data/signs.ts` — display text (name, description,
  hint, reference clip path) for the UI. Same sign names, but NOT used for verification — easy to
  confuse with the engine registry above; don't edit one expecting it to affect the other.

## The five parameters every sign declares
handshape (dominant + optional nondominant), location, movement, palm orientation, non-manual
markers — see [[Architecture]] for why each is independently gated. `min_confidence` on each is
the calibration knob; see `tools/calibrate_from_dataset.py` for how real ASL Citizen/WLASL clips
were used to validate these against real signers (2026-07-06 session — found the current numbers
were already correct, but surfaced that COFFEE↔YES, DOCTOR↔NURSE, and MEDICINE↔DOCTOR can't be
separated by geometry alone, only by [[Code-Map-ML-Pipeline|the ML veto]]).

## Confusor fixtures
Every sign with required movement ships a `_correct` and `_confusor` fixture under `tests/fixtures/`
(Python) and `web/tests/fixtures/` (TS) — real or synthetic landmark sequences replayed through
`verify()` as regression tests. See [[Architecture#Confusor test pattern]].
