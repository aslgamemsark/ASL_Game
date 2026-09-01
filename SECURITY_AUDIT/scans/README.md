# Raw scan artifacts

Only tools that ACTUALLY RAN produce files here. Nothing in this directory is
synthesized, and no result elsewhere in SECURITY_AUDIT/ is inferred from a tool
that did not execute.

| File | Tool | Version | Ran |
|---|---|---|---|
| `npm-audit-2026-09-01.txt` | `npm audit` | npm 11.12.1 | 2026-09-01 |

## Tools that did NOT run

Recorded so their absence is never mistaken for a clean result:

- **Semgrep** — install attempted, failed. No native Windows support.
- **Docker / Supabase CLI** — not installed. This blocked ALL runtime verification:
  no local Postgres, so no live authorization testing, no exploit reproduction,
  and no execution of the regression suite in `web/e2e/security-rls.spec.ts`.
- **Trivy, OSV-Scanner, Gitleaks, TruffleHog, Nuclei, sqlmap, Schemathesis,
  RESTler, OWASP ZAP, testssl.sh** — not installed, not run.

Gitleaks now runs in CI (`.github/workflows/security.yml`) even though it could not
be run locally.

## What ran instead

- Manual white-box review of all 36 SQL migrations, computing effective RLS state
  by replaying policy create/drop order (the two real findings came from here).
- Extraction and verification of every `admin_*` function's final body.
- Custom git-history + shipped-bundle secret scan (regex + JWT decode).
- Production-shaped build differential analysis — rebuilding with `VITE_POSTHOG_KEY`
  set to reproduce what Vercel actually ships, which materially changed the
  dependency-reachability conclusion (see FINDINGS.md F-005).
- Passive production checks: HTTP security headers, TLS/HSTS, public-path exposure.
