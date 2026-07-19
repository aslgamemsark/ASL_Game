# Naming

### Names must be precise — first guess must be correct
A developer seeing the name for the first time, without context, must be able to guess correctly what it represents.

BAD: lock — used for both physical disk block numbers and logical file block numbers. Caused 6 months debugging a data corruption bug.
GOOD: ile_block (index within a file), disk_block (physical location on disk)

BAD: count — count of what?
GOOD: 
um_active_indexlets

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
BAD: lock used sometimes for file blocks, sometimes for disk blocks
GOOD: ile_block everywhere for file blocks, disk_block everywhere for disk blocks — no exceptions

Rule: if the same name is used for two different things anywhere in the codebase, rename one immediately.