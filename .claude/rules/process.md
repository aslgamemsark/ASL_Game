# Process

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

### Compact at 70% context

When context usage reaches ~70%, run `/compact` immediately — before continuing any work. Do not wait until the window is nearly full.

---

### Context Handoff Protocol

When context usage exceeds ~85%, or before ending a session with remaining phases incomplete:

1. Write/update `HANDOFF.md` in project root containing:
   - Phase(s) completed, with file list
   - Any deviations from the original plan document, and why
   - Current test status (passing/stubbed/e2e-untested)
   - Whether phase completion criteria were actually verified
     (not just "tests pass" — the specific manual checks required)
   - Exact next step for the following phase

2. Commit all completed work before ending the session —
   HANDOFF.md is a pointer to real code, never a substitute for it.

3. At the start of any new session on this project, before writing any code:
   read HANDOFF.md, read the plan document, and read the actual current
   state of relevant source files. Do not assume continuity from
   conversation memory alone.

---

### Live API run — daily quota detection

During any live run that calls an external API, a 429 or rate-limit error may
indicate either a per-minute TPM limit (expected, retryable) or a daily/account-level quota
exhaustion (not retryable — waiting it out wastes time and produces no new data).

To distinguish them:
- Check `retry-after` header: values of seconds or a few minutes → per-minute limit, proceed with
  normal retry. Values of hours, or absent with a message mentioning "daily", "quota", or
  "account" → daily limit.
- Check the error message text for keywords: "daily", "quota", "account limit", "monthly",
  "exhausted" → daily limit.

Rule: if a 429/rate-limit indicates a daily or account quota (not a per-minute window), stop
immediately and report it — do not wait, do not retry.