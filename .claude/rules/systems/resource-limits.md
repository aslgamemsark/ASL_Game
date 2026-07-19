# Resource Limits

Operating systems impose hard limits on many resource types — limits that are real, finite,
and will be hit in production even if never reached in development under low load.

### File descriptors — every open must have a guaranteed close

On Unix-like systems the default per-process file descriptor limit is often ~1024 (`ulimit`).
When exhausted, new opens fail system-wide — the entire process stops functioning, not just
the feature that caused the leak.

Rule: every open file, socket, or pipe must have a guaranteed close on every exit path,
including exception paths. Use context managers (`with`/`using`) or `try`/`finally`. Never
rely on garbage collection or process exit to close resources eventually.

---

### Threads and processes — never spawn unboundedly

The OS maintains a finite pool of process slots (PIDs). When exhausted, no process on the
entire machine can start new ones — this can bring down unrelated software.

BAD: one thread per incoming connection with no cap — a traffic spike exhausts thread/PID
limits

GOOD: a bounded thread pool or async I/O that handles many connections within a fixed number
of OS threads

Rule: never write code that spawns an unbounded number of threads or processes in response
to external input. Use a bounded pool with a fixed maximum.

---

### Zombie processes — always reap child processes

A child process that has exited but whose parent has not read its exit status becomes a
zombie. Each zombie holds a process-table slot. Enough zombies exhaust the PID limit even
though none are doing real work.

Rule: always `wait()`/`waitpid()` on child processes explicitly — even if you don't care
about their exit code — or use a library abstraction that does this for you.

---

### Disk space — never assume writes succeed

When disk fills, writes fail — but the failure may be silent (a write call returns success
while the OS silently discards data) or manifests as a crash far from the actual full-disk
site. Logging itself can fail, making diagnosis difficult.

Rule: never assume a write succeeds. Check write return values explicitly in any code path
where disk-full is plausible. Monitor free space in any long-running service; alert before
it fills, not after.

---

### Network connections — always use pooling with a hard maximum

Ephemeral port ranges and per-process socket limits are finite. A connection pool with no
maximum will exhaust ports or remote server limits under load, turning healthy traffic into
connection failures.

Rule: always use connection pooling with an explicit maximum size. Connections must be
returned to the pool on every exit path — the same close-on-every-path discipline as file
descriptors. Never create one connection per request with no pool.
