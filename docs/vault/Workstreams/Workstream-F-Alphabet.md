# Workstream F — Fingerspelling alphabet expansion

**Status: done.** Added `LETTER_W` and `LETTER_I` (7/26 letters now signed, up from 5).

## What changed
- `signs/letter_w.py`, `signs/letter_i.py` (+ TS mirrors in `web/src/engine/signs/index.ts`).
- `core/handshape.py` / `web/src/engine/handshape.ts`: added an `"i"` exact-pattern
  (`thumb=0, index=0, middle=0, ring=0, pinky=1` — the `thumb=0` is required, not incidental, or a
  real Y-hand thumb+pinky pose would also pass as I).
- Fixtures/tests in both `tests/test_vocabulary.py` and the new `web/tests/letters.test.ts`.
- `web/src/data/alphabet.ts` — `signId` set for W and I.

## Why the plan's original 5-letter batch (H, N, U, W, I) shrank to 2
The plan proposed reusing `core/handshape.py`'s existing `h`/`n`/`u` patterns for new letters. On
inspection, **`v`, `n`, `h`, `u` are literally the identical geometric check**
(`index=1, middle=1, ring=0, pinky=0` — see [[Architecture]]#handshape-blind-spot). That's
acceptable for NURSE/HOSPITAL because their required REPEATED/LINEAR movement carries the real
discrimination. A fingerspelling letter has **no movement at all** — nothing to disambiguate on.
Shipping `LETTER_H`/`LETTER_N`/`LETTER_U` would have meant:
- `LETTER_U` would be a literal duplicate of the already-shipped `LETTER_V`'s check within the
  *same* alphabet-practice screen — a real, user-facing false-accept, not just a theoretical risk.
- `LETTER_N`'s real ASL handshape is fingers curled over the thumb — geometrically nothing like
  the extended-fingers pattern. Reusing it would teach the wrong handshape.
- `LETTER_H` could theoretically be distinguished from `LETTER_U` via the existing (but
  `required=False` everywhere in the codebase, and self-described as "rough/lightweight") palm
  `OrientationReq`. Making it the *first* required-orientation sign, for the highest-stakes
  discrimination case, with zero prior calibration data, was judged too risky to ship blind.

**Deferred, not abandoned:** H and U need a validated orientation check; N needs a genuine
curled-over-thumb predicate. Both are real, scoped follow-up work, not forgotten.

## Deferred entirely (per the plan, unchanged)
C, O, S, T, D, E, F, K, M, R, X need a new thumb-to-fingertip proximity/curvature predicate family
`core/handshape.py` doesn't have. J, Z need motion-tracing — a new `MovementKind`. Both are bigger,
separately-scoped efforts.
