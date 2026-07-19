# Order Violations

### Never assume step A finishes before step B unless something actually enforces it

An order violation is when code assumes two operations happen in a specific sequence —
"initialization completes before the first request arrives," "the write commits before the
read executes," "this callback fires before that one" — but nothing in the system actually
guarantees that order. The assumption holds in testing and fails under load, on different
hardware, or after an unrelated change shifts the timing.

BAD:
```
# Thread A: writes to shared_config during startup
# Thread B: reads shared_config to handle the first request
# Assumed: A finishes before B starts — not enforced by anything
```

GOOD: use an explicit synchronization point (a lock, an event, a `Future`, a startup
barrier) that Thread B cannot pass until Thread A signals completion

Rule: whenever logic depends on "this step completes before that step starts," ask: is this
order actually enforced by something concrete in the code — a lock, an `await`, an
initialization guard — or is it assumed based on how it has usually behaved? If it's
assumed, it is an order violation waiting to occur.

---

### Initialization order is the most common instance

Global state, module-level singletons, and constructor-initialized objects are frequently
accessed before they are fully initialized, especially in systems that start multiple threads
or processes at startup.

BAD: a background thread starts during module import and immediately reads a configuration
object that is still being populated by the main thread

GOOD: the background thread does not read the configuration until an explicit signal
(an event, a `ready` flag guarded by a lock) confirms initialization is complete

Rule: treat any shared state as uninitialized until an explicit signal marks it ready — not
until "it looks like initialization usually finishes first."
