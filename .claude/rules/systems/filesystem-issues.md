# Filesystem Issues

### Always use the platform's path library — never hand-build paths

Path separators, case sensitivity, and path-length limits differ between operating systems:
`/` vs `\`, case-sensitive (Linux) vs case-insensitive (Windows/macOS by default), 260-
character MAX_PATH on older Windows. Hand-built paths break silently when moved across
platforms.

BAD:
```python
path = base_dir + "\\" + subdir + "\\" + filename   # breaks on Unix
```

GOOD:
```python
path = pathlib.Path(base_dir) / subdir / filename   # correct on all platforms
```

Rule: always use the platform's path-manipulation library (`pathlib`, `os.path`, `path.join`,
`std::filesystem`) for constructing, joining, and normalizing paths. Never concatenate path
components with string operations.

---

### File locking is advisory on most Unix systems

Advisory locks on Unix (e.g. `flock()`, `fcntl()` `F_RDLCK`/`F_WRLCK`) can be silently
ignored by any process that doesn't bother to check them. They are a cooperation mechanism,
not a mandatory enforcement mechanism — two processes that both bypass the lock will proceed
concurrently.

Rule: treat advisory file locking as a courtesy mechanism between cooperative processes
only. For correctness-critical mutual exclusion, use a mechanism that cannot be bypassed —
a database-level advisory lock, a named OS mutex, or a separate lock-management service.

---

### Use atomic file operations where the platform provides them

Checking "does this file exist" and then creating it as two separate operations has a TOCTOU
gap: another process can create the file between the check and the create. Many platforms
provide atomic "create exclusively; fail if already exists" calls that close this gap.

BAD:
```python
if not os.path.exists(lock_file):
    open(lock_file, 'w').write(str(os.getpid()))   # TOCTOU — gap between check and create
```

GOOD:
```python
fd = os.open(lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)   # atomic; raises if exists
```

Rule: prefer atomic file operations (exclusive create, compare-and-swap rename) wherever
the platform offers them rather than check-then-act sequences.

---

### Always specify encoding explicitly when reading or writing text

A file's encoding is not self-describing in most formats. The implicit platform default
encoding differs between operating systems and locales — UTF-8 on most Linux systems, often
Windows-1252 or UTF-16 on Windows by default.

BAD:
```python
open("data.txt").read()   # encoding depends on system locale; silently wrong on Windows
```

GOOD:
```python
open("data.txt", encoding="utf-8").read()   # explicit, portable, predictable
```

Rule: always specify `encoding` explicitly at every file read/write boundary. Never rely
on an implicit system default.
