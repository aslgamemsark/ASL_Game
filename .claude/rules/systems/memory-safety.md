# Memory Safety

### In memory-unsafe languages, always bounds-check before writing

A buffer overflow — writing past the end of allocated memory — occurs when array or buffer
access is not bounds-checked before use. In C/C++, this produces silent memory corruption;
in safer languages, an exception or panic.

Rule: in memory-unsafe languages (C/C++), bounds-check every array and buffer access before
writing. Prefer memory-safe types (`std::string`, `Vec`, `std::vector`) over raw buffers.
In memory-safe languages, an out-of-bounds access panics rather than silently corrupting
memory — which is better, but still a crash that needs defensive bounds logic at trust
boundaries.

---

### Never hold a reference past the lifetime of what it points to

Use-after-free occurs when a pointer or reference outlives the object it points to. The
memory may be reallocated to something else, producing silent data corruption or crashes
that bear no obvious relation to the use-after-free site.

Rule: prefer ownership-tracking language features (RAII, smart pointers, garbage collection,
borrow checker) over manual memory management. Never hold a raw pointer/reference past the
guaranteed lifetime of the object it references.

---

### Every resource has exactly one owner responsible for freeing it

Double-free occurs when cleanup code runs more than once for the same allocation — once on
the normal path and again on an error path, or because two code paths both believe they own
the cleanup.

Rule: any given resource must have exactly one, unambiguous owner responsible for freeing
it. If ownership transfers, the old owner must stop holding a reference. Use RAII or
context managers so the cleanup is bound to the scope, not manually remembered on every
code path.

---

### Always initialize variables before first use

Reading an uninitialized variable produces undefined behavior in C/C++ — its value depends
on whatever happened to be in that memory, which varies by OS, compiler, run, and
optimization level.

Rule: always explicitly initialize variables before first use. Enable compiler warnings and
sanitizers (AddressSanitizer, MemorySanitizer) that catch this class specifically. In
languages that don't guarantee zero-initialization, never assume a newly allocated value
is zero or null.
