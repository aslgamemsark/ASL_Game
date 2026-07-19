# No Hardcoding

Do not hardcode values, paths, credentials, thresholds, magic numbers,
environment-specific settings, or provider/model names directly in source code.
Anything that could reasonably differ between environments, change over time, or
need swapping later must be configurable — via environment variables, config files,
or named constants defined in one place — never inline where the logic uses it.

---

### Why

Every hardcoded value is a future bug waiting for the moment reality no longer
matches the assumption baked into the code. This project has already hit real
instances of this:

- Model provider/name hardcoded inline would have made switching from Groq to
  another provider a code rewrite instead of a config change — avoided by reading
  `GROQ_BASE_URL` / `ADAPTIVE_LAYER_MODEL` from the environment.
- A block-detection keyword list hardcoded specific phrases, which broke the moment
  a real site used one of those words in an unrelated, non-blocking context.
- Timeout and retry values (`_MODEL_TIMEOUT_SECONDS`, `_MODEL_API_RETRIES`) were
  correctly made named constants in one place rather than scattered magic numbers —
  this is the right pattern to follow everywhere else too.

---

### What must never be hardcoded

- **Secrets and API keys** — always from environment variables, never committed,
  never inline (already enforced by the project's secret-scanning hook — keep it
  that way).
- **URLs, hostnames, ports, file paths specific to one machine/environment** — read
  from config or environment, with a sensible default only where genuinely universal.
- **Provider/model names** — swappable via config, so changing providers is a
  settings change, not a rewrite.
- **Magic numbers with real behavioral meaning** (timeouts, retry counts, thresholds,
  caps) — always a named constant defined once, never a bare number repeated inline
  at each use site.
- **Anything discovered empirically about a specific target** (a specific site's
  field names, a specific site's exact selector, a specific site's exact response
  shape) — these belong in the adapter/cache layer as data, not embedded in
  general-purpose logic.

---

### What's fine to hardcode

- Values that are genuinely fixed, universal, and part of the program's own logic
  (an enum's valid states, a fixed protocol format, a genuinely constant relationship
  like a unit conversion).
- A default value for a config setting, as long as it's overridable and not the
  only path.

---

### Practical check before committing

Ask: if this value needs to change next month — a new provider, a new deployment,
a new environment, a new target site — does changing it mean editing a
config/environment variable, or does it mean finding and editing source code? If
the answer is "finding and editing source code," it's hardcoded and should be moved
to config.