# Time and Date Handling

### Always store timestamps in UTC — never local time

Storing or comparing local times without timezone information produces bugs whenever the
code runs across different timezones, or across a daylight-saving transition — a timestamp
stored as "01:30" during DST rollback is ambiguous; an "elapsed time" computed by
subtracting local timestamps across a DST change is wrong by exactly one hour.

BAD:
```python
event_time = datetime.now()   # local time, timezone-naive — ambiguous and non-portable
```

GOOD:
```python
event_time = datetime.now(timezone.utc)   # UTC, timezone-aware — unambiguous everywhere
```

Rule: always store timestamps internally in UTC or as a timezone-aware type. Convert to
local time only at the final human-facing display step — never for storage, comparison, or
arithmetic.

---

### Use a monotonic clock for elapsed time on one machine

Wall-clock time (`datetime.now()`) can jump backwards or forwards if NTP adjusts the system
clock during a run — producing negative or wildly inflated "elapsed time" measurements.

BAD:
```python
start = datetime.now()
do_work()
elapsed = (datetime.now() - start).total_seconds()   # can be negative after NTP correction
```

GOOD:
```python
start = time.monotonic()
do_work()
elapsed = time.monotonic() - start   # monotonic; never goes backward
```

Rule: use a monotonic clock for measuring elapsed time on a single machine. Use UTC
wall-clock time (with NTP-synced tolerance) only for cross-machine comparisons where
approximate synchronization is sufficient.

---

### Use the platform's date library for all calendar arithmetic

Days per month vary. Years have 365 or 366 days. Leap seconds exist. A hardcoded "one day
= 86,400 seconds" or "one year = 365 days" is wrong during DST transitions and leap years
respectively.

BAD:
```python
next_month = current_date + timedelta(days=30)   # wrong — months have 28, 29, 30, or 31 days
```

GOOD:
```python
from dateutil.relativedelta import relativedelta
next_month = current_date + relativedelta(months=1)   # correct regardless of month length
```

Rule: use the platform's date/time library for all date arithmetic — never hand-roll
calendar math. The only exception is arithmetic purely in seconds on monotonic timestamps,
which carries no calendar semantics.

---

### Use 64-bit timestamps for anything with a long lifetime

32-bit signed Unix timestamps overflow in January 2038 (the "Year 2038 problem"). This is
not a hypothetical — any system storing 32-bit timestamps that will still be running in
2038, or storing dates beyond 2038 even today, will produce incorrect results.

Rule: use 64-bit (or wider) timestamp representations for any system with a lifetime
extending past 2038 or that stores timestamps representing future dates beyond that point.
