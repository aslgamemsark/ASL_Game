# Networking

### Every network call must have an explicit timeout

A network call with no timeout hangs indefinitely if the remote server stops responding —
blocking the calling thread, the connection pool slot, or the entire process permanently.
"The network never fails" is never a safe assumption in production.

BAD:
```python
response = requests.get(url)   # no timeout — hangs forever if server doesn't respond
```

GOOD:
```python
response = requests.get(url, timeout=30)   # explicit; caller fails cleanly after 30s
```

Rule: every network call — HTTP, database, cache, RPC — must have an explicit timeout.
No exceptions. Default library timeouts (often infinite or very long) are not acceptable
for production code.

---

### Use randomized backoff on retry — not fixed-interval

When many clients/instances retry a failing call at the same time with the same fixed
interval, they synchronize — they all hit the upstream simultaneously, re-triggering the
overload they were supposed to let recover.

BAD:
```python
for _ in range(3):
    if call_api().ok: break
    time.sleep(2)   # all callers retry at the same moment — thundering herd
```

GOOD:
```python
for attempt in range(3):
    if call_api().ok: break
    time.sleep(2 ** attempt + random.uniform(0, 1))   # jitter breaks lockstep
```

Rule: use exponential backoff with random jitter, not fixed-interval retry. See also
`livelock.md` for the hard ceiling requirement.

---

### Respect DNS TTLs — don't cache resolved addresses indefinitely

A load balancer or failover change won't be picked up if the resolved IP is cached longer
than the DNS TTL specifies. Long-lived connections that skip re-resolution after the TTL
will continue hitting a stale endpoint.

Rule: respect DNS TTLs explicitly if long-lived connections matter. Do not assume a resolved
address stays valid indefinitely. Re-resolve on connection establishment for connection-
pooled clients if the pool holds connections longer than the service's DNS TTL.

---

### Always close/return connections to their pool

HTTP and database connections checked out of a pool must be returned on every exit path,
including exceptions. An unreturned connection holds a pool slot permanently — same
discipline as file descriptors (see `resource-limits.md`).

Rule: every connection pool checkout needs a guaranteed return via context manager or
`try`/`finally`. A pool with a fixed maximum that leaks slots will eventually exhaust and
refuse new connections to all callers, not just the one that leaked.

---

### Correlate concurrent responses explicitly — never assume ordering

Sending multiple concurrent requests and assuming responses arrive in the same order they
were sent is an ordering assumption that most protocols do not guarantee.

BAD: send three requests in sequence, read three responses in sequence, assume response 1
matches request 1

GOOD: tag each request with a correlation ID and match responses by ID rather than by
position in the receive order

Rule: explicitly correlate requests to responses with IDs or futures tied to the specific
call. Never assume response ordering matches request ordering.
