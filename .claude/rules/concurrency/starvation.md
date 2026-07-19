# Starvation

### Shared, rate-limited, or capacity-bounded resources must be treated as contended

Starvation occurs when one consumer of a shared, limited resource is perpetually denied
access while other consumers keep getting served. This is not a crash-and-error failure — it
produces an unfair, hard-to-reproduce failure where one part of the system silently gets
nothing while another operates normally.

BAD: a background indexing job and an interactive search feature share the same API rate
limit with no coordination — the indexer saturates the quota and every search request gets
a 429 with no recourse

GOOD: explicit rate limiting on the calling side (separate quota budgets per consumer,
priority queues, or deliberate pacing) rather than relying on the external resource's own
error responses as the only signal that something's wrong

Rule: never write code that assumes a shared external resource — an API quota, a database
connection pool, a lock, an ephemeral port range — has effectively unlimited capacity, even
if it seems that way in low-volume use. Handle capacity-exceeded responses as an expected,
ordinary outcome to be handled gracefully, not a surprising error to patch after it is first
observed in production.

---

### Build fairness in; don't rely on retry alone

When multiple consumers legitimately need access to a shared limited resource, retry with
backoff is not sufficient on its own — a high-volume consumer with fast retries will
out-compete a low-volume consumer indefinitely.

Rule: if multiple consumers need fair access to a shared limited resource, build deliberate
fairness mechanisms (priority queues, per-consumer rate limits, token buckets) into the
calling code. External error responses (429, pool-exhausted) are a last-resort signal, not a
fairness mechanism.
