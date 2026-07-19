# Internationalization and Encoding

### Use locale-independent formats for machine-to-machine data

Number formatting (decimal comma vs. period), date formatting (MM/DD/YYYY vs. DD.MM.YYYY
vs. YYYY-MM-DD), and sorting order differ by system locale. Code that formats or parses
numbers or dates using the system locale works in the developer's locale and fails silently
in others — returning wrong values rather than errors.

BAD:
```python
value = float("1.234,56")   # parses correctly in German locale; fails in US locale
date_str = date.strftime("%x")   # locale-dependent format; "07/19/26" vs "19.07.26"
```

GOOD:
```python
value = decimal.Decimal("1234.56")   # locale-independent; explicit decimal separator
date_str = date.isoformat()   # ISO 8601: "2026-07-19" everywhere, regardless of locale
```

Rule: use explicit, locale-independent formats for all machine-to-machine data — ISO 8601
for dates, `.` as the decimal separator in stored numeric data. Localize only at the final
human-facing display step, and only explicitly (not by relying on the system's implicit
locale setting).

---

### Specify encoding explicitly at every read/write boundary

Text encoding is not self-describing in most formats. The implicit platform default differs
between systems — UTF-8 on most Linux systems, often Windows-1252 or UTF-16 on Windows.
Data written in one encoding and read assuming another produces corrupted text that may not
be detected until a multi-byte character appears.

BAD:
```python
open("report.txt").read()         # encoding depends on system locale — wrong on non-UTF-8 systems
open("report.txt", "w").write(s)  # same: writes platform default, not necessarily what readers expect
```

GOOD:
```python
open("report.txt", encoding="utf-8").read()
open("report.txt", "w", encoding="utf-8").write(s)
```

Rule: always specify encoding explicitly at every file, socket, or byte-stream read/write
boundary. Never trust an implicit system default. UTF-8 is the correct default for
interchange data unless a specific other encoding is required by an external protocol.
