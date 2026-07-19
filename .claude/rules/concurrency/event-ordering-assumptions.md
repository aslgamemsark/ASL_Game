# Event Ordering Assumptions

### Enumerate every in-flight operation before declaring a step complete

A common race condition shape: a system decides a step is done by checking one observable
signal — "has this state stopped changing?", "is the DOM stable?", "did the queue drain?" —
when in reality something relevant can still be in progress, invisible to that one signal.
The signal stabilises before the real work finishes, and the system acts on a lie.

BAD: an SPA quiescence check polls DOM size to decide "the page has loaded" — but a React
component may mount and fire a data fetch *after* the DOM has settled in its loading shell,
and the browser closes before the API response arrives

GOOD: track in-flight work directly (a counter of pending fetch/XHR requests, an explicit
"ready" signal from the subsystem doing the work) and require both the surface-level signal
AND the in-flight counter to reach zero before declaring quiescence

Rule: before writing any "is this operation complete?" check, explicitly enumerate everything
that could plausibly still be in progress, and make sure the check accounts for all of it —
not just the one thing that happened to be the easiest to observe.

---

### Assumed orderings must be named and justified

Code often contains implicit ordering assumptions: "the config loads before the server
accepts connections," "the cleanup handler runs before the next request starts." These are
ordering guarantees that are assumed but not stated. When they hold, the code works. When
they don't — typically under different load or on different hardware — the code fails in ways
that don't point back to the assumption.

BAD: the assumption exists only in the author's mental model; nothing in the code enforces
or documents it

GOOD: the ordering is enforced by something concrete (a lock, a startup barrier, an
explicit await), and the code comment names what it is

Rule: whenever logic depends on "this happens before that," that ordering must be either
enforced by something explicit in the code, or the code must be designed so that the correct
outcome is produced regardless of which order things actually happen in. An ordering that
"usually" holds is not a guarantee.
