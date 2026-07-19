# Red Flags — stop and redesign if any of these appear

- **Shallow module** — interface almost as complex as the implementation
- **Information leakage** — same design decision reflected in multiple modules
- **Temporal decomposition** — code structure follows execution order instead of knowledge ownership
- **Pass-through method** — a method that only calls another method with the same signature and does nothing else
- **Pass-through variable** — a variable in a function signature never used in that function's body
- **Repetition** — same non-trivial pattern appears more than once — wrong abstraction
- **Conjoined methods** — cannot understand one without reading the other
- **Vague name** — broad enough to mean many things
- **Comment repeats code** — adds no information beyond what the code already shows
- **Implementation contaminates interface** — interface comment describes how, not what
- **Nonobvious code** — reader's first guess about behavior is wrong
- **Hard to name** — struggling to find a clean name — fix the design, not the name