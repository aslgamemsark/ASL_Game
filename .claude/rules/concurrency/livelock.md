# Livelock

### Retry loops must have a hard ceiling and must change behavior between attempts

A livelock occurs when a system keeps retrying an operation but makes no real progress —
nothing is technically blocked, but the same failure recurs every time. An unbounded retry
loop that retries the exact same action the exact same way is a livelock the instant the
underlying condition doesn't self-resolve.

BAD:
```
while True:
    result = call_api()
    if result.ok:
        break
    time.sleep(1)   # same interval, same action, forever if the API never recovers
```

GOOD:
```
for attempt in range(MAX_ATTEMPTS):
    result = call_api()
    if result.ok:
        break
    wait = min(BASE_DELAY * 2**attempt + random.uniform(0, 1), MAX_DELAY)
    time.sleep(wait)   # exponential backoff with jitter; gives up after MAX_ATTEMPTS
else:
    raise RetryExhausted("API did not recover after max attempts")
```

Rule: every retry loop must have:
1. A hard ceiling — a maximum number of attempts or a maximum elapsed time, after which
   it gives up and surfaces a clear failure.
2. A change in strategy between attempts — exponential backoff with jitter (to avoid
   thundering-herd retry storms), an alternate code path, or explicit escalation.

Retrying the exact same call at the exact same interval, indefinitely, is not error
handling — it is an infinite loop that happens to call an external service.
