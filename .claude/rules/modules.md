# Module Design

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
`python
def insert_string(self, text, offset):
    self.text_area.insert_string(text, offset)  # does nothing else — dead layer
`
GOOD: file system layers — top layer exposes files (variable byte arrays), middle layer exposes fixed-size cached blocks, bottom layer exposes raw hardware I/O. Each crossing changes what you know.

Rule: if a method only calls another method with the same signature and does nothing else, delete it.

---

### Pull complexity downward
When complexity must exist, it belongs inside the module — not spread across every caller.

BAD:
`python
# module throws PacketDroppedException
# now every HTTP client, every database driver, every SSH session must implement retry logic
`
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