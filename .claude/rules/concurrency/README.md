# Concurrency and Timing Rules

One file per rule. Each is self-contained.

- [race-conditions.md](race-conditions.md) — correctness must not depend on unguarded timing; atomicity violations
- [toctou.md](toctou.md) — check-then-act gaps; cached facts go stale between check and use
- [deadlock.md](deadlock.md) — fixed global lock-acquisition order; keep critical sections short
- [livelock.md](livelock.md) — retry loops must have a hard ceiling and change strategy between attempts
- [starvation.md](starvation.md) — shared limited resources must be treated as contended; build fairness in
- [order-violations.md](order-violations.md) — assumed step ordering must be enforced by something concrete
- [fire-and-forget-tasks.md](fire-and-forget-tasks.md) — every async task must be awaited, tracked, or explicitly justified
- [resource-cleanup.md](resource-cleanup.md) — structural cleanup on every exit path, not just the happy path
- [event-ordering-assumptions.md](event-ordering-assumptions.md) — enumerate all in-flight work before declaring a step complete
- [testing-concurrency-bugs.md](testing-concurrency-bugs.md) — force adverse conditions deterministically; "usually passes" is not proof
