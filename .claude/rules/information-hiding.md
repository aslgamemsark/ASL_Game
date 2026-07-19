# Information Hiding

### Every module hides one design decision
Pick one thing to encapsulate. That decision must not appear in the interface.

BAD: getParams() returns Map<String, String> — exposes the internal data structure. Change how params are stored internally, every caller breaks.
GOOD: getParameter(name) returns String — hides how parameters are stored. Internal refactor touches zero callers.

Rule: if a caller has to know about your internal data structure to use your module, you have leaked information.

---

### No information leakage — same knowledge must not exist in two modules
If two modules both understand the same design decision, changing that decision requires fixing both.

BAD: a "read HTTP request" class and a "parse HTTP request" class — both need to understand HTTP message format
GOOD: one class that reads and parses — HTTP format knowledge exists once

Rule: when you see the same concept appearing in two separate modules, ask whether one of them should own it exclusively.

---

### Do not structure code around execution order
"First read, then parse, then validate" — structuring code this way causes leakage because the same knowledge appears in multiple steps.

BAD: FileReader, FileParser, FileWriter as separate classes because that is the execution order — both Reader and Parser must understand the file format
GOOD: one FileHandler that owns the format knowledge and handles all three phases

Rule: structure around what knowledge is needed, not when operations happen.

---

### Eliminate special cases in code
Design the normal case to handle edge cases automatically without extra branches.

BAD:
`python
if selection.is_empty:
    return  # special case everywhere
else:
    delete(selection.start, selection.end)
`
GOOD: empty selection = start == end. delete(start, end) where start == end deletes nothing. No branch. No special case. The edge case falls out of the normal logic.

Rule: before adding an if-branch for an edge case, ask whether you can redefine the data model so the edge case becomes a degenerate version of the normal case.

---

### No pass-through variables
A variable threaded through multiple functions just to reach the one that uses it forces all intermediate functions to know it exists.

BAD: tls_cert passed through main() → init() → setup() → connect() → send() — only send() uses it
GOOD: store tls_cert in an AppContext object at startup. send() reads it from context. Nothing else knows it exists.

Rule: if a variable appears in a function signature but is never used in that function's body, it is a pass-through variable. Remove it.

---

### Separate interface declaration from implementation
Define what a module does in one place. Define how it does it in another. The interface is the contract — what callers depend on. The implementation is the internals — what callers must never depend on.

BAD: callers import and use internal helper functions directly
BAD: interface comment describes implementation details
GOOD: public API surface is explicitly defined and stable. Internal functions are private/prefixed/unexported.

Rule: if a caller has to read your implementation to know how to use your module, the interface is not doing its job.
Rule: changes to implementation must never require changes to callers. If they do, implementation details have leaked into the interface.

---

### Design for testability
A module that cannot be tested in isolation is a module with hidden dependencies.

BAD: a class that directly instantiates its dependencies inside methods — untestable without the real thing
GOOD: dependencies passed in via constructor or function arguments — can be replaced with fakes in tests

Rule: if you cannot test a module without spinning up a database, network, or external service, the module has not properly separated its concerns.
Rule: pure functions (same input always produces same output, no side effects) are the easiest to test and the easiest to reason about. Prefer them for logic-heavy code.

Note: dependency injection is not a pass-through variable. A pass-through variable is one that intermediate functions carry but never use. An injected dependency is used by the class that receives it.

---

### Make concurrency explicit — never hide shared state
BAD: a module that silently reads and writes shared state without documenting it
GOOD: shared state is clearly identified, access is controlled through one owner, and the comment documents thread-safety guarantees

Rule: if a module modifies state that any other thread or process can also modify, that fact must be explicit in the interface comment.
Rule: prefer immutable data. A value that cannot change cannot have a race condition.