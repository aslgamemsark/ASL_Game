# Architecture

## The five-parameter sign schema
Every ASL sign is defined by **handshape, location, movement, palm orientation, non-manual
markers**. `core/schema.py`'s `Sign` dataclass declares each as data; `core/verifier.py`'s
`verify()` scores each parameter independently and gates overall pass on **every required
parameter clearing its own threshold** — never an average.

**Why this exists:** the original COFFEE checker only looked at handshape+location on a single
frame and falsely passed a motionless two-fist pose, because COFFEE actually requires circular
motion. `Sign.__post_init__` now structurally forbids declaring a movement kind without marking it
required (see `core/schema.py:156-166`) — the bug class is unrepresentable, not just avoided by
convention.

## Movement is a rolling-window judgment, never a single frame
`core/movement.py` reads a *trajectory* (timestamped positions across ~1.5-2s), not one frame.
Four kinds exist: `NONE`, `LINEAR`, `CIRCULAR`, `REPEATED`, `CONVERGE`. There is **no "diverge"
kind** — a sign whose defining motion is two hands moving apart (e.g. an early draft of a
classroom BOOK sign) cannot be honestly represented yet. See [[Workstream-A-Classroom]] for where
this constraint changed a sign's design mid-session.

## Dual-engine parity
`core/` (Python) is the source of truth per CLAUDE.md; `web/src/engine/` (TypeScript) mirrors it
sign-by-sign. Every new sign ships in both, with matching confusor tests in `tests/` (pytest) and
`web/tests/` (vitest). `web/tests/feature-parity.test.ts` additionally checks the ML feature
extractors (`clipToSequence` vs `ml/dataset.py`) stay numerically identical.

## Handshape scoring has a real blind spot — read before adding new signs
`core/handshape.py`'s exact-pattern matcher (`_PATTERNS`) only counts per-finger extension; it has
no model of thumb position or hand rotation. This means `v`, `n`, `h`, and `u` are **the exact
same geometric check** — they're only safely distinguishable today when a two-handed **required
movement** carries the real discrimination (e.g. NURSE, HOSPITAL, and the new NAME sign). Reusing
one of these for a **static, movement-less** check (like a fingerspelling letter) makes it
genuinely ambiguous with the others. Full reasoning: [[Workstream-F-Alphabet]].

## Confusor test pattern
Every movement sign ships a `_correct` fixture (performs the real motion) and a `_confusor`
fixture (freezes the same handshape, no motion) — both replayed through `verify()` as automated
tests. `tools/make_synth_fixtures.py` / `tools/make_classroom_fixtures.py` generate these
deterministically (no camera needed, reproducible in CI).
