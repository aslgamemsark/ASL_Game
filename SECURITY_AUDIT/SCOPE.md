# Scope & Authorization Boundary

**Audit date:** 2026-09-01
**Audit type:** White-box source review + dependency/secret scanning + passive production verification
**Standard targeted:** OWASP ASVS 5.0 Level 2 (L1 mandatory)

## In scope

| Asset | Detail | Testing permitted |
|---|---|---|
| Repository | `github.com/aslgamemsark/ASL_Game` (local working copy `D:\ASL_Game`) | Full static analysis |
| Web app source | `web/` — Vite + React SPA | Full static analysis |
| Database schema | `supabase/migrations/*.sql` — 35 migrations + 1 added by this audit | Full static analysis |
| Production origin | `https://quicksignn.vercel.app` | **Passive only** — TLS, HTTP headers, public-path exposure |

## Explicitly OUT of scope

- **Supabase project `juzqilqilxzmudazltjx`** (hosted DB/auth) — no DB credentials held by the auditor; no queries were run against it, read or write.
- **Third-party services**: PostHog, MediaPipe CDN (`cdn.jsdelivr.net`), `storage.googleapis.com`, `ipwho.is`, `ipapi.co`, OpenRelay TURN, Google OAuth. Configuration *as consumed by this app* was reviewed; the providers themselves were never scanned or attacked.
- Any other Vercel project, domain, subdomain, or neighbouring infrastructure.

## Rules of engagement actually followed

Per the audit brief, active attack techniques are permitted only against localhost/staging with synthetic data, never production.

**No local or staging environment could be created.** `docker` is not installed on this machine, and the Supabase CLI is unavailable, so `supabase start` could not stand up a local Postgres/PostgREST stack. Consequently:

- **No active testing was performed at all.** No fuzzing, no SQL injection probing, no authorization manipulation, no upload attacks, no API mutation, no brute force, no DoS.
- Production received only safe, passive, unauthenticated requests: `HEAD`/`GET` on public paths to read response headers and status codes. No authentication was attempted, no account was created, no data was read beyond public static assets.
- **The two authorization findings (F-001, F-002) are therefore confirmed by code analysis, not by runtime exploitation.** This is stated explicitly in FINDINGS.md and in the final verdict. Executable regression tests were written (`web/e2e/security-rls.spec.ts`) and are ready to run the moment a local stack exists — they were authored but **not executed**.

Nothing was scanned outside the authorized targets above. No production data was read, modified, or deleted.

## Tools: intended vs. actually available

| Tool | Status |
|---|---|
| `npm audit` | **Ran** — npm 11.12.1 |
| Manual source review | **Ran** — primary method |
| `curl` passive header/exposure checks | **Ran** — production, read-only |
| Custom git-history + bundle secret scan (regex/entropy) | **Ran** |
| Production-shaped build differential analysis | **Ran** |
| Semgrep | **Not available** — install failed; Semgrep has no native Windows support |
| Docker / Supabase CLI | **Not installed** — blocked all runtime verification |
| Trivy, OSV-Scanner, Gitleaks, TruffleHog, Nuclei, sqlmap, Schemathesis, RESTler, ZAP, testssl.sh | **Not installed / not run** |

Everything not run is recorded as **NOT VERIFIED** in `ASVS_5_MATRIX.md` and listed under Known Limitations in `FINAL_SECURITY_REPORT.md`. No result in this audit is inferred from a tool that did not execute.
