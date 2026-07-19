# Process, Signal, and Platform Behavior

### Handle graceful-shutdown signals — never ignore SIGTERM/SIGINT

A process that does not handle termination signals (SIGTERM, SIGINT, Ctrl+C, Windows
console events) will be killed ungracefully, leaving shared resources — lock files, temp
files, partial writes, open database transactions — in a bad state for the next run.

BAD: a long-running worker process that ignores SIGTERM and is killed mid-write, leaving a
half-written output file that looks complete

GOOD: a SIGTERM handler that sets a flag, lets the current unit of work complete, flushes
buffers, closes connections, and exits cleanly

Rule: any long-running process must handle at minimum SIGTERM (and SIGINT where
interactive) with a graceful shutdown path — flush pending writes, release locks, close
connections, delete temp files — before exiting.

---

### Priority inversion — don't hold shared resources across high-latency operations

Priority inversion occurs when a low-priority task holds a resource a high-priority task
needs, while unrelated medium-priority tasks keep running and prevent the low-priority task
from ever releasing it.

Rule: when priority scheduling is in use, use priority-inheritance-aware locking primitives
if the platform offers them. In all cases, avoid holding shared resources (locks, connections,
file handles) across any operation that can block for an indeterminate time — release early,
re-acquire if needed.

---

### Process creation differs meaningfully between Unix and Windows

Unix `fork()` copies the entire process address space. Windows has no true `fork()` and
uses `CreateProcess` with a fresh address space. Code that relies on `fork()` semantics
(open file descriptors inherited by the child, memory state preserved) does not transfer to
Windows without explicit porting.

Rule: never write platform-specific process-spawning assumptions into cross-platform code
without testing on both platforms. Use a cross-platform subprocess library rather than
calling OS primitives directly where possible.

---

### Mutual exclusion for singleton services must be explicit, not assumed

Two copies of the same process running concurrently and both assuming exclusive access to a
shared resource — a file, a port, a database row — will corrupt each other's work silently.
Deployment configuration is not a reliable exclusion mechanism.

Rule: if only one instance of a process should ever run at a time, enforce that with an
OS-level or application-level mutual exclusion mechanism (a lock file with `O_EXCL`, a
named mutex, a database advisory lock). Never rely solely on deployment assumptions.
