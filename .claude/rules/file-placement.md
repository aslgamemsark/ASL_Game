# File Placement

Throwaway scripts, manual test harnesses, stress-test tooling, and any
exploratory/one-off code must live under `tests/` (or a clearly separated
`scripts/` directory if the project has one), never in the project root.

The project root is reserved for actual configuration (`pyproject.toml`,
`.gitignore`, `CLAUDE.md`) and real source packages.

Before creating any new file, check whether it's part of the shipped product
or a testing/exploration tool, and place it accordingly. If unsure, ask rather
than defaulting to root.