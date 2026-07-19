# Comments

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

BAD: uint32_t offset;  // current offset
GOOD: uint32_t offset;  // position of the first byte not yet returned to the client

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

BAD: # check if i is less than NUM_READ_RPC — restates the code
GOOD: # Phase 1: scan active RPCs to see if any have completed
GOOD: # Null check required here — prevents race condition with auth thread, see issue #4521

Rule: if a comment describes what a single line of code does mechanically, delete it. If it describes what a block of code accomplishes overall, keep it.

---

### Keep comments physically close to the code they describe
A comment far from its code goes stale when the code changes. Nobody updates what they cannot see.

Rule: method interface comment goes directly above the method body. Implementation comments go directly above the block they describe, not at the top of the method.
Rule: important decisions go in the code as comments, not in commit messages. Commit messages are never read.