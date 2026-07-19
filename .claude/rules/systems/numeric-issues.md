# Numeric Issues

### Size integer types to the actual expected range, including headroom

Integer overflow occurs when a calculation exceeds the numeric type's representable range.
In languages without automatic big-integer promotion (C, C++, Rust in release mode), the
value wraps silently or panics — neither is obvious at the point of the original mistake.

BAD:
```c
uint16_t byte_count = num_records * sizeof(record);  // overflows silently if num_records > 65535/sizeof(record)
```

GOOD: use a type wide enough for the actual expected range with realistic headroom; check
for overflow explicitly before multiplication if the inputs are unbounded

Rule: use appropriately-sized types for the actual expected range. In languages without
automatic overflow detection, explicitly check for overflow before operations that could
exceed the type's range. In languages with checked arithmetic, enable it.

---

### Never compare floats for exact equality

Floating-point values are inherently approximate. Two computations that should produce the
same mathematical result may produce values that differ in the last significant bit, making
exact equality comparison unreliable.

BAD:
```python
if result == 0.1 + 0.2:   # evaluates to False — floating-point rounding
```

GOOD:
```python
if abs(result - (0.1 + 0.2)) < 1e-9:   # epsilon-based comparison
```

Rule: never compare floating-point values with `==`. Use an epsilon-based comparison
appropriate to the domain. For money or any value requiring exact precision, use a
fixed-point or decimal type rather than floating-point.

---

### Always test boundary values explicitly

Off-by-one errors — miscounting boundary conditions in loops, array indexing, or slice
operations — produce bugs that only manifest at the edges of the input space, which are
exactly the conditions often skipped in quick manual testing.

BAD: a loop `for i in range(len(items))` accessing `items[i+1]` — the last iteration reads
past the end

Rule: explicitly test boundary values — empty input, single-element input, exactly-at-the-
limit input — as a standard part of test coverage for any code that indexes into arrays,
iterates with bounds, or computes sizes. Do not treat boundary testing as an afterthought.
