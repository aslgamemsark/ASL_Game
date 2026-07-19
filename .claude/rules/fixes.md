# Fix Discipline

## No threshold-widening, numeric-tuning, or special-casing as a substitute for a root-cause fix

When a test fails or a real site produces a wrong result, the fix must address the actual
mechanism that produced the wrong output — not just move the failure point.

Before applying any fix, it must pass all of the following checks:

**1. State the mechanism, not the symptom.**
"X was too small/short/low" is not a mechanism. "We discard information Y that an earlier
stage already computed, and use Z instead" is a mechanism. The mechanism statement must name
the specific code path and the specific decision it made that turned into a wrong output.

**2. Ask: will this fix hold for a different site with a different shape of the same problem?**
If the fix only works because the current failing test case happens to fit under a new
number or threshold, it is a band-aid, not a fix, and must not be shipped.

**3. Prefer reusing information the system already computed.**
Before widening a limit or adding a hardcoded exception, ask: did an earlier stage or
pre-filter already produce a signal that would distinguish the correct from the wrong path?
If yes, use that signal. Widening a numeric limit discards the signal that would have
distinguished the cases.

**4. Every fix ships with a regression test on the mechanism, not just the one site.**
A test that only re-confirms "site X now passes" is insufficient. The regression test must
be constructed around the underlying mechanism — a synthetic fixture that triggers exactly
the code path the fix addresses. If that synthetic test passes and the mechanism is gone,
then the site oracle passing is a consequence, not proof.

**5. Numeric tuning knobs designated in the spec may still be adjusted.**
`COMMIT_THRESHOLD`, `FINGERPRINT_SIMILARITY_THRESHOLD`, `MIN_LIST_COUNT`, `SETTLE_CAP_SECONDS`
are declared tuning knobs (§12). They may be adjusted — but only as a declared, reasoned,
documented decision, never as the default first move when something breaks. Changing an
undeclared constant to make a failing test pass is a band-aid unless the mechanism check
(step 1) justifies it independently.

---

### Rationale

This module exists specifically to prevent silent, confident wrong answers. A hardcoded
band-aid tends to fail silently on whatever site doesn't match the shape of whatever test
prompted the patch — which is the exact failure mode the whole spec was built to eliminate,
just relocated from design into implementation.

The §14 precision gate catches confident-but-wrong verdicts. A band-aid passes the
precision gate by hiding the wrong answer behind `needs_review=True` or by widening the
detection window just enough to catch the current test case. Neither is a fix.

---

### Application record

**2026-07-18 — Classifier content-truncation / Wikipedia regression:**

See the detailed evaluation in HANDOFF.md (Phase 7, fix discipline application).

Summary:
- Classifier prompt tightening: PASSES the fix discipline check. The mechanism was that the
  classifier accepted page-level metadata (title, OG tags) as sufficient evidence of data
  presence. The fix addresses the mechanism and holds universally across all sites.
- Wikipedia SKIP regression — two-part root-cause fix applied:

  **Part 1 — TOC false-positive** (`prefilters.py:_in_excluded_zone`, `_EXCLUDED_CLASS_PATTERNS`):
  `has_list_structure()` false-positived on TOC `<li>` elements in `<div id="toc">` because
  the excluded-zone check only covered tag names (`<nav>` etc.) not id/class patterns. Fixed
  by adding `toc|table-of-contents|tableofcontents` to `_EXCLUDED_CLASS_PATTERNS` and
  checking the `id` attribute in `_in_excluded_zone()`. 4 mechanism tests added.

  **Part 2 — Wrong content slice to classifier** (`prefilters.py:extract_list_content`,
  `stage_http.py`, `stage_browser.py`):
  Even after the TOC fix, the classifier still received `html[:8000]` (the page head and nav),
  while the actual S&P 500 table lived at ~15k chars. The pre-filter already traversed the DOM
  and located the table; that location information was discarded. Fixed by replacing
  `has_list_structure()` + `html[:8k]` with `extract_list_content()` which returns the parent
  element's HTML of the LARGEST qualifying group — giving the classifier content that starts
  at the data. A secondary bug: the function must pick the LARGEST group (not the first) so
  that a 500-row data table wins over a small category-link list. Verified live: Wikipedia now
  commits `tier=STATIC confidence=1.00 stage_reached=2` (no browser involved). 4 mechanism
  tests added (deep-list detection, largest-group selection, consistency with has_list_structure).
