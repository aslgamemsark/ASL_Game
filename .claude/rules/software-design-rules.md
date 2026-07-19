# Software Design Rules (Ousterhout) — for Claude Code

## Complexity

- Complexity is the only real enemy. If a change is hard, ask why — don't just make it work.
- Complexity accumulates in small steps. No single shortcut is the problem. Accumulation is.
- Zero tolerance on small compromises. "Just this once" does not exist.

---

## Module Design

### Modules must be deep
Simple interface. Enormous hidden work behind it.

BAD: caller must create SmtpConnector, call .auth(), build MimeMessage, call .send(), then log manually
GOOD: send_email(to, subject, body) — one call, everything else hidden inside

Rule: if the caller has to orchestrate multiple steps to use your module, the module is shallow.

---

### Simple interface is more important than simple implementation
If complexity must exist somewhere, put it inside the module. Make the implementer suffer so 100 callers don't have to.

BAD: expose insert_line() and delete_line() because they're simple to implement — every caller must now split/join lines manually
GOOD: expose insert(position, text) and delete(start, end) — harder to implement, but every caller is trivial

Rule: never make the interface simpler by pushing work onto callers.

---

### Design for the common case
95% of callers want the default behavior. Don't make them ask for it explicitly.

BAD: Java file I/O — buffering was opt-in, everyone had to manually wrap every reader in BufferedInputStream
GOOD: Unix file I/O — sequential reads are buffered by default, random access via lseek() is opt-in

Rule: the common case must require zero extra knowledge. Rare cases opt in.

---

### Each layer must change the abstraction
Every layer should give the caller a meaningfully different view of the system.

BAD:
```python
def insert_string(self, text, offset):
    self.text_area.insert_string(text, offset)  # does nothing else — dead layer
```
GOOD: file system layers — top layer exposes files (variable byte arrays), middle layer exposes fixed-size cached blocks, bottom layer exposes raw hardware I/O. Each crossing changes what you know.

Rule: if a method only calls another method with the same signature and does nothing else, delete it.

---

### Pull complexity downward
When complexity must exist, it belongs inside the module — not spread across every caller.

BAD:
```python
# module throws PacketDroppedException
# now every HTTP client, every database driver, every SSH session must implement retry logic
```
GOOD: TCP retransmits dropped packets silently. Applications get a clean byte stream. Retry logic exists in one place.

Rule: if you're about to throw an exception or expose a configuration parameter, ask first — can I handle this internally?
Limit: only pull complexity down if (a) it's closely related to the module's existing job, (b) it simplifies callers, and (c) it simplifies the interface. Don't pull unrelated complexity down just to hide it.

---

### General-purpose interfaces are deeper
A slightly general interface hides more and requires less code than one built for one specific use case.

BAD: backspace(cursor), delete_char(cursor), delete_selection(selection) — three methods, each for one UI operation
GOOD: delete(start, end) — one method that handles all three cases

Rule: if you have multiple methods that do the same thing in slightly different contexts, replace them with one general method.
Limit: don't make it so general it becomes hard to use. "Somewhat general-purpose" is the target — general enough to serve multiple uses, specific enough to be practical today.

---

### Separate general-purpose and special-purpose code
The general core must have zero knowledge of specific use cases. Special logic goes above or below it, never inside it.

BAD: undo mechanism hardcoded inside the text class — it knows about text insertions, cursor positions, selections all mixed together
GOOD: a general History class with addAction(action), undo(), redo() — knows nothing about text or cursors. Text class creates UndoableInsert objects. UI creates UndoableCursor objects. Each registers with History.

Rule: if your general-purpose module contains an if-branch that exists because of one specific caller's needs, that branch does not belong there.

---

## Information Hiding

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
```python
if selection.is_empty:
    return  # special case everywhere
else:
    delete(selection.start, selection.end)
```
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

---

## Error Handling

### Define errors out of existence first
Before writing an error handler, ask: can I redesign the API so this error cannot occur?

BAD: unset(varname) throws VariableNotFoundError — every caller wraps it in try/catch
GOOD: redefine unset as "ensure variable does not exist" — if already gone, return silently. Error defined away.

BAD: Windows blocks deletion of open files — causes crashes and user frustration
GOOD: Unix marks file for deletion, frees disk when last handle closes — no error for deleter, no error for readers

Rule: this is not the same as suppressing errors. Suppressing = catching and ignoring. Defining away = redesigning the semantics so the error condition cannot arise.

---

### Mask exceptions inside the module
If your module can handle an exception internally, handle it there. Do not surface it to callers who cannot act on it.

BAD: network module throws PacketDroppedException — every caller must implement retry logic
GOOD: TCP retransmits dropped packets silently — callers get a clean stream

Rule: only surface an exception if the caller has information or authority to handle it that the module does not have. If the module can resolve it, resolve it internally.
Limit: do not mask exceptions that callers genuinely need to know about. If the server is permanently down, the caller needs to know — masking that would hide critical information.

---

### Aggregate exceptions — one handler not fifty
Let exceptions propagate to one place that handles all of them. Do not wrap every call in its own try/catch.

BAD:
```python
try:
    photo_id = get_parameter("photo_id")
except NoSuchParameter:
    return error_response("missing photo_id")
try:
    user_id = get_parameter("user_id")
except NoSuchParameter:
    return error_response("missing user_id")
```
GOOD:
```python
def dispatch(request):
    try:
        handle(request)
    except NoSuchParameter as e:
        return error_response(e.message)  # one handler catches all
```

Rule: if multiple catch blocks in different places do the same thing, they belong in one place higher up the stack.

---

### For unrecoverable errors — crash fast with a clear message
Out of memory, disk corruption, internal inconsistency — you cannot recover from these meaningfully.

BAD: malloc returns NULL, every caller checks return value, handles it differently, most forget to check
GOOD: ckalloc() wraps malloc, aborts immediately with a clear message if allocation fails

Rule: if the only honest response to an error is "this should never happen and we cannot continue," crash immediately at the point of detection with a message that explains what happened.

---

## Comments

### Write interface comments before implementing
Write the comment describing what a function does before writing the function body.

Process:
1. Write the class interface comment
2. Write method signatures and their comments — leave bodies empty
3. Iterate on the comments until the abstraction feels right
4. Then fill in the bodies

Rule: if writing the comment is hard, the abstraction is wrong. Fix the design, then the comment becomes easy.

---

### Comments describe what code cannot
Code shows how. Comments capture: why a decision was made, what preconditions exist, what invariants hold, what units a variable uses, what null means, when to call this method.

BAD: `uint32_t offset;  // current offset`
GOOD: `uint32_t offset;  // position of the first byte not yet returned to the client`

Rule: after writing a comment, ask — could someone write this comment by only reading the code next to it? If yes, the comment has zero value.

---

### Interface comments must not describe implementation
The comment before a function tells callers what it does, not how it works.

BAD: "This method is implemented using a DCFT module and checks rules in a particular order"
GOOD: "Returns true if the next call to getNext() will return immediately without blocking"

Rule: if your interface comment mentions internal data structures, internal method names, or implementation strategies — delete that part. It belongs inside the function, not before it.

---

### Implementation comments: what and why, not how
Inside a method, comments describe what a block accomplishes at a higher level, and why non-obvious decisions were made.

BAD: `# check if i is less than NUM_READ_RPC` — restates the code
GOOD: `# Phase 1: scan active RPCs to see if any have completed`
GOOD: `# Null check required here — prevents race condition with auth thread, see issue #4521`

Rule: if a comment describes what a single line of code does mechanically, delete it. If it describes what a block of code accomplishes overall, keep it.

---

### Keep comments physically close to the code they describe
A comment far from its code goes stale when the code changes. Nobody updates what they cannot see.

Rule: method interface comment goes directly above the method body. Implementation comments go directly above the block they describe, not at the top of the method.
Rule: important decisions go in the code as comments, not in commit messages. Commit messages are never read.

---

## Naming

### Names must be precise — first guess must be correct
A developer seeing the name for the first time, without context, must be able to guess correctly what it represents.

BAD: `block` — used for both physical disk block numbers and logical file block numbers. Caused 6 months debugging a data corruption bug.
GOOD: `file_block` (index within a file), `disk_block` (physical location on disk)

BAD: `count` — count of what?
GOOD: `num_active_indexlets`

Rule: if a developer could reasonably misunderstand what the name refers to, the name is wrong.

---

### Use types to make illegal states unrepresentable
A type system that can express constraints is better than a comment that describes them.

BAD: a function that accepts String for both a user ID and a session token — wrong value passes silently
GOOD: distinct types UserID and SessionToken — passing the wrong one is a compile error

Rule: if a variable has constraints on its valid values, encode those constraints in the type where possible rather than documenting them in comments.

---

### If you cannot name it cleanly, the design is wrong
Struggling to find a name signals the thing does not have a clear identity.

BAD: a variable that sometimes holds a user ID, sometimes a session token, sometimes null
GOOD: separate variables with clear single purposes

Rule: do not settle for a vague name and move on. Fix the design.

---

### One name per concept, used everywhere, never reused for anything else
BAD: `block` used sometimes for file blocks, sometimes for disk blocks
GOOD: `file_block` everywhere for file blocks, `disk_block` everywhere for disk blocks — no exceptions

Rule: if the same name is used for two different things anywhere in the codebase, rename one immediately.

---

## Process

### Strategic over tactical — but know your context
Before adding a feature, ask: is the current design still correct given this change?

BAD: adding a second data source with `if source == 'source_b'` branching into existing pipeline
GOOD: recognizing two sources now exist, abstracting a Source interface, implementing both as separate classes

Exception: if this code is an experiment to validate whether something is worth building at all — ship dirty and delete it. Throwaway code should be thrown away.

Rule: before investing in a clean abstraction, ask — is this code surviving the next month? If yes, design it properly. If no, don't.
Rule: a minimal change that preserves a wrong design makes the system worse, not just the same.

---

### Design it twice
Before committing to any significant interface, sketch two different approaches and compare.

Rule: one hour comparing two approaches for a class interface is always worth it. The comparison reveals tradeoffs the first idea hides.

---

### Increment in abstractions, not features
When a new abstraction is needed, design it completely. Do not add a special-purpose hack with plans to refactor later.

BAD: `if token: validate()` scattered across 6 endpoints — "we'll refactor later"
GOOD: a clean AuthService with a well-defined interface before the feature ships

Rule: later never comes. The feature is not done until the abstraction is clean.

---

### Optimize for the reader, not the writer
Code is read far more than it is written.

BAD: `return new Pair<Integer, Boolean>(currentTerm, false)`
GOOD: `return ElectionResult(term=currentTerm, voted=false)`

Rule: if a shortcut saves you time writing but costs readers time understanding, it is debt, not a shortcut.

---

## Red Flags — stop and redesign if any of these appear

- **Shallow module** — interface almost as complex as the implementation
- **Information leakage** — same design decision reflected in multiple modules
- **Temporal decomposition** — code structure follows execution order instead of knowledge ownership
- **Pass-through method** — a method that only calls another method with the same signature and does nothing else
- **Pass-through variable** — a variable in a function signature never used in that function's body
- **Repetition** — same non-trivial pattern appears more than once — wrong abstraction
- **Conjoined methods** — cannot understand one without reading the other
- **Vague name** — broad enough to mean many things
- **Comment repeats code** — adds no information beyond what the code already shows
- **Implementation contaminates interface** — interface comment describes how, not what
- **Nonobvious code** — reader's first guess about behavior is wrong
- **Hard to name** — struggling to find a clean name — fix the design, not the name