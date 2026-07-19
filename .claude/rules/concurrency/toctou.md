# TOCTOU (Time-Of-Check to Time-Of-Use)

### A condition checked now may be false by the time you act on it

TOCTOU is the concurrency form of stale data: a fact is checked at one moment ("is this
file writable?", "does this user have permission?", "does this entry exist?") and then acted
on later — even a few lines later — as though it's still true. Between the check and the
action, anything else running concurrently can change the condition.

BAD:
```
if not os.path.exists(path):   # check: file doesn't exist
    open(path, 'w')             # act: create it — another process may have created it here
```

GOOD: use an atomic "create exclusively; fail if exists" call that the OS guarantees as one
operation (`open(path, 'x')` in Python, `O_CREAT | O_EXCL` in POSIX), so there is no gap

Rule: whenever code checks a condition and then acts on the result of that check, ask — can
anything change this condition in the gap between the check and the act? If yes, use an
atomic check-and-act primitive if one exists, or protect the check-and-act pair as a
single critical section.

---

### Never treat a one-time startup check as permanently valid

A fact that was true at startup — a configuration setting, an external service's state, a
file's existence — can change during the program's lifetime. Caching that check result and
trusting it forever is TOCTOU on a longer timescale.

BAD: verify write permission to the log directory at startup, then assume it remains
writable for the entire process lifetime

GOOD: handle each write's failure explicitly, or re-check on a meaningful boundary (e.g.
after a reload signal), not just once at boot

Rule: never optimize a correctness-critical check into a one-time startup check for
performance reasons. If a fact can change during the process's lifetime, the check must be
repeatable.
