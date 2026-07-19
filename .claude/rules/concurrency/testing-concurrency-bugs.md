# Testing Concurrency Bugs

### A test that "usually passes" for a concurrency bug is not meaningfully different from no test

Concurrency bugs pass most of the time. Their defining characteristic is that the specific
conditions that trigger them — unusual timing, high load, a cold-started process, a slow
network response — are exactly the conditions least likely to appear in a quick manual test
or a small automated suite run under comfortable, low-load conditions.

This makes "it passed every time I tested it" especially weak evidence for this bug class.
A race condition that triggers once in ten thousand runs has not been caught by a test suite
that ran ten times.

Rule: for any fix addressing a bug from the concurrency/timing category, prefer a test that
deliberately and deterministically forces the adverse condition — the specific unlucky
ordering, the exhausted resource, the concurrent access — rather than a test that simply
re-runs the original scenario and hopes the bad timing recurs.

BAD: a regression test for a quiescence race condition that re-runs the same real URL and
checks whether the correct data is captured — passes when Chromium starts warm, fails when
it starts cold

GOOD: a hermetic fixture that mechanically produces the adverse timing (e.g. a local server
that delays its response by 1s past the point where the DOM would otherwise stabilize),
deterministically forcing the race, so the test either proves the fix works or proves it
doesn't — regardless of Chromium warm/cold state, machine load, or network timing

---

### Name concurrency bug fixes explicitly in the commit and handoff record

A fix described as "TOCTOU on the quiescence check" or "in-flight race between DOM
stability and response arrival" teaches the next reader something specific and reusable. A
fix described only by its symptom ("it was flaky sometimes") teaches nothing — the next
person who sees a similar pattern has no way to recognize it as the same class.

Rule: when a concurrency bug is found and fixed, name the bug class explicitly (race
condition, TOCTOU, order violation, fire-and-forget loss, etc.) in the commit message,
the handoff record, and any regression test docstring — not just the symptom.
