# Race Conditions

### Correctness must not depend on timing that nothing enforces

A race condition occurs when the result of an operation depends on the relative timing or
ordering of two or more concurrent things, and nothing in the system actually guarantees
that order. The bug is present whether or not it has ever been observed — if the correct
outcome depends on a specific ordering and that ordering is not enforced, the code is wrong
even when it happens to produce the right answer.

BAD: two threads read a counter, both increment it, both write back — one increment is lost
because the read-modify-write is not atomic

GOOD: use an atomic increment (a language-level atomic type, a lock, or a database-level
compare-and-swap) so the sequence is indivisible regardless of scheduling

Rule: never write code whose correctness assumes a particular ordering of concurrent
operations unless something explicit — a lock, a mutex, an atomic operation, an `await` —
actually enforces that order.

---

### Atomicity violations are race conditions on multi-step sequences

A sequence that must be logically indivisible — "read a value, then update it based on what
was read" — becomes a race condition the instant another thread can observe or modify the
shared state between the steps.

BAD:
```
if item not in cache:          # step 1: check
    cache[item] = compute(item)  # step 2: write — another thread may write here first
```

GOOD: use a lock around the entire check-then-write, or use a "create-if-absent" atomic
primitive that the platform/library provides

Rule: any sequence of "check, then act on what was checked" on shared mutable state is an
atomicity violation unless the entire sequence is protected as a unit, not just the
individual steps.
