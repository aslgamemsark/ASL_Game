# Recognition architecture

[The root architecture guide](../../ARCHITECTURE.md) describes the shipped app.
[AGENTS.md](../../AGENTS.md) owns the five-parameter, rolling-window and per-parameter pass rules.
`web/src/engine/` is the production runtime; `core/` is the Python reference/offline implementation.
There is no requirement to fix Python first when a browser bug is reported.

## Historical design evidence

- The original COFFEE failure approved motionless fists. Movement requirements and static-confusor
  regressions exist to prevent that class of error; they do not certify linguistic correctness.
- [[Workstream-A-Classroom]] records how unsupported movement requirements changed an early
  scenario design. Inspect today's schema before assuming the old set of movement kinds still applies.
- [[Workstream-F-Alphabet]] records the original Python H/N/U handshape ambiguity. Treat it as
  historical evidence; inspect current letter scorers before reusing an old restriction.
- Synthetic fixtures make regression tests repeatable but do not establish performance for real
  learners. Keep correct/confusor coverage and [real calibration evidence](../CALIBRATION_LOG.md).
- Python/TypeScript ML feature parity is tested separately from sign-definition parity. Do not
  infer that every engine rule or display instruction is synchronized from a feature test passing.
