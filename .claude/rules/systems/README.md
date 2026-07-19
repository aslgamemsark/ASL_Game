# Systems and OS-Level Bug Rules

One file per category. Each is self-contained. Concurrency is covered in `../concurrency/`.

- [memory-safety.md](memory-safety.md) — buffer overflow, use-after-free, double-free, uninitialized reads
- [resource-limits.md](resource-limits.md) — file descriptors, thread/PID limits, zombie processes, disk space, connection pools
- [process-signals.md](process-signals.md) — graceful shutdown, priority inversion, fork/exec portability, singleton exclusion
- [filesystem-issues.md](filesystem-issues.md) — path portability, advisory locking limits, atomic file operations, encoding
- [networking.md](networking.md) — timeouts, jittered backoff, DNS TTLs, connection pool cleanup, response correlation
- [numeric-issues.md](numeric-issues.md) — integer overflow, floating-point equality, off-by-one boundary testing
- [time-date-handling.md](time-date-handling.md) — UTC storage, monotonic clocks, calendar arithmetic, 64-bit timestamps
- [silent-error-handling.md](silent-error-handling.md) — swallowed exceptions, trust-boundary validation, async failure visibility
- [internationalization-encoding.md](internationalization-encoding.md) — locale-independent formats, explicit encoding at every I/O boundary
