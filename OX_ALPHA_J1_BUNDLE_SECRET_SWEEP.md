# OX_ALPHA_J1_BUNDLE_SECRET_SWEEP.md

**Task:** ASL-J1 · `[REPORT]` Client-bundle secret sweep against `dist/` — grep the built output for
keys, tokens, JWTs, private-key blocks, and credential-shaped strings.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `5e98d48`) ·
**Method:** executed pattern sweep (`web/e2e-adhoc/probe-secret-sweep.mjs`) over **124 files** in
`dist/` — 8 secret-pattern families plus expected-public-value checks. Read-only; matches are
redacted in output. No code changed.

---

## 1. Executed results

- **Files scanned:** 124 (all of dist/)
- **Pattern hits:** 1 — a single JWT-shaped string in `dist/assets/supabase-*.js`

## 2. The one hit, classified (not a leak)

Decoding the token's header/payload (signature never printed):

- header `{alg: HS256, typ: JWT}`, payload `{iss: "supabase", ref: juzqilqilxzmudazltjx, role: anon}`
- **role = `anon`** — this is the **Supabase anon key**, which is *designed* to be public. It ships in
  every Supabase client bundle by design; security comes from Row Level Security policies server-side,
  not from key secrecy.
- It is long-lived (exp 2036) because Supabase anon keys are static project identifiers, not sessions.
- No `service_role` key, no OpenAI/Gemini/Anthropic keys, no private-key blocks, no generic
  api_key/secret assignments anywhere in the bundle.

## 3. Expected-public values confirmed present (context check)

| Value | Status | Assessment |
|---|---|---|
| VITE_SUPABASE_URL (`https://juzqilqilxzmudazltjx.supabase.co`) | PRESENT | Public by design |
| PostHog project token (`phc_…`) | PRESENT | Public ingest token by design |

## 4. Verdict

**Clean.** Zero true secrets in the shipped client bundle. The single pattern hit is the by-design
public anon key. The historical J4 concern (a Supabase JWT leaked once) is not recurring here — the
only JWT present is the anon key itself.

Standing caveat (unchanged from prior audits): anything inlined into a client bundle is public;
the discipline that matters is never adding service-role/admin credentials to any `VITE_*` env var —
this build demonstrates that discipline holds today.

## 5. Re-run

`node web/e2e-adhoc/probe-secret-sweep.mjs` after any build (exit 0 = zero pattern hits; exit 1 =
inspect redacted contexts).
