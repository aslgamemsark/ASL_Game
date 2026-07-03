# Workstream C — Security hardening

**Status: done.** Scope was the concrete gaps a security-review agent found — the app's
foundations (RLS policies, no `dangerouslySetInnerHTML`, parameterized Supabase queries, no
committed secrets, fully client-side recognition) were already solid; this closed specific gaps,
not a rebuild.

## Changes
- `web/src/config/classifier.ts`: `CLASSIFIER_DEBUG` was hardcoded `true` — now
  `import.meta.env.DEV`, so it's automatically off in production builds with no manual toggle to
  remember. (Was leaking every ML gate decision + `window.__lastVote` to the console in prod.)
- `web/src/components/auth/AuthModal.tsx`: password `minLength` 6 → 8.
- `web/package.json`: added `"audit": "npm audit --audit-level=high"` script. Ran clean (0
  vulnerabilities) at time of writing.

## Explicitly NOT coded (documented instead)
- Username-signup TOCTOU race is already DB-constraint-protected — acceptable as-is.
- Auth rate-limiting is a Supabase **dashboard** setting, not app code — a client-side "fix" here
  wouldn't actually enforce anything. Flagged for the user to check in the Supabase project
  settings, not implemented.
- A full CI/dependency-scanning workflow is a bigger, separate ask than "add an audit script" —
  noted as a real follow-up, not silently expanded into this session's scope.
