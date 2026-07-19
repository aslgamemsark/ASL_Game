# Deadlock

### Never let two threads acquire the same locks in different orders

A deadlock occurs when two or more threads each hold a resource the other needs, and each
waits for the other to release — permanently. Neither can make progress without outside
intervention. Deadlocks are often latent: the code runs fine for months until two threads
happen to reach the acquisition points in the unlucky order under realistic load.

BAD:
```
# Thread A: acquires lock_a, then tries to acquire lock_b
# Thread B: acquires lock_b, then tries to acquire lock_a
# If A holds lock_a and B holds lock_b simultaneously — deadlock
```

GOOD: define a global acquisition order (e.g. always lock_a before lock_b, everywhere in
the codebase) and enforce it; neither thread ever holds a later lock without first holding
the earlier one

Rule: whenever code acquires more than one lock, those locks must always be acquired in the
same fixed global order across every code path in the entire codebase. A violation of this
ordering discipline is a potential deadlock, regardless of how unlikely the interleaving
seems in practice.

---

### Keep critical sections short

The longer a thread holds a lock, the longer every other thread must wait — and the more
paths exist where an exception or early return might exit the lock region incorrectly.

Rule: acquire a lock as late as possible and release it as early as possible. Do not hold a
lock across I/O, across network calls, or across any operation that can block for an
indeterminate time. Use `try`/`finally` or a context manager so the release is structurally
guaranteed even if an exception fires inside the critical section (see `resource-cleanup.md`).
