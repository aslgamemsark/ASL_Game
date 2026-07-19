# Resource Cleanup Under Concurrency

### Every resource requiring explicit cleanup must be cleaned up on every exit path

Any resource that is not automatically reclaimed the instant it is no longer referenced — an
open file, a network connection, a lock, a subprocess, a browser session — is a leak risk
the moment cleanup code only runs at the end of a normal, successful code path. An
exception, an early return, or a cancellation partway through will skip a cleanup step
written as an afterthought at the bottom of a function.

BAD:
```
conn = pool.acquire()
result = db.query(conn, sql)   # if this raises, conn is never returned to the pool
pool.release(conn)
```

GOOD:
```
with pool.acquire() as conn:   # context manager guarantees release on every exit path
    result = db.query(conn, sql)
```

Or with explicit try/finally:
```
conn = pool.acquire()
try:
    result = db.query(conn, sql)
finally:
    pool.release(conn)         # runs regardless of exception, return, or cancellation
```

Rule: always use a structural guarantee for cleanup — a context manager (`with`/`using`),
a `try`/`finally` block, or an RAII-style pattern — rather than cleanup code placed only
after the normal logic. The test: if you mentally inject an exception at every single line
of the function, does the resource still get released in every case? If not, the cleanup is
not structurally guaranteed.

---

### Concurrency multiplies the impact of leaks

A leak that loses one resource per call is a slow, invisible problem in a single-threaded
system. Under concurrent load, the same leak loses many resources simultaneously, exhausting
the pool or the OS limit rapidly. Connection pool exhaustion, file descriptor exhaustion, and
lock non-release all follow this pattern — acceptable in isolation, catastrophic at scale.

Rule: treat resource leaks under concurrency as high-severity by default, not low-severity.
A single missed cleanup path on a connection or lock is a production incident at load.
