# Silent Error Handling

### Never swallow an exception silently

A caught exception that is discarded with no logging and no propagation turns a detectable
failure into an invisible one. The system appears to work; the error is gone. The actual
failure manifests later, at a different location, with no trace back to the original cause.

BAD:
```python
try:
    process_record(record)
except Exception:
    pass   # record silently dropped; no log, no metric, no alert
```

GOOD:
```python
try:
    process_record(record)
except Exception:
    logger.exception("Failed to process record %s — skipping", record.id)
    failed_records.append(record)   # tracked for later retry or alerting
```

Rule: every caught exception must be logged, re-raised, or explicitly and deliberately
handled with a comment explaining why silence is safe here. A bare `except: pass` block is
a standing code-review red flag. "Don't care about the result" must never mean "don't care
if it silently failed."

---

### Validate at every trust boundary — never assume upstream validation covers you

Code that skips input validation because "the caller already validated it" is one refactor
away from a bug. The caller's validation logic can change, the code can be called from a
new path, or the validation can be incomplete for edge cases the caller didn't anticipate.

BAD: a database write function that skips validation because "the API handler already
checked the input" — now any internal caller that bypasses the API handler gets no
validation

GOOD: validate at the function boundary whenever the function is a trust boundary — the
point where external or loosely-controlled input enters a system

Rule: validate at every trust boundary — user input, network responses, file contents,
inter-process messages. Never assume a trust boundary further up the call stack covers all
paths that could reach the current function.

---

### Fire-and-forget async tasks must still surface failures

An asynchronous task that is never awaited and has no error-observing callback can fail
silently — the exception is discarded before anyone sees it. See `fire-and-forget-tasks.md`
for the full treatment.

Rule: "fire-and-forget" is not the same as "fire and ignore all failures." Even intentional
fire-and-forget tasks must log exceptions. A failure that cannot be observed is a failure
that cannot be fixed.
