# Runtime authorization harness

Phase 1 of this audit could only source-review its findings: no Docker on the audit machine meant
no local Supabase, so nothing was ever executed. Phase 2 closes that gap **without Docker** by
running the real migrations against real PostgreSQL compiled to WebAssembly
([PGlite](https://github.com/electric-sql/pglite) — PostgreSQL 18.3, in-process).

This is not a mock. RLS, policies, triggers, `SECURITY DEFINER`, `CHECK` constraints and role
switching all behave exactly as they do on a Supabase instance, so an attack that succeeds here
succeeds in production, and one that is blocked here is genuinely blocked.

## Run it

```bash
cd web && npm install --no-save @electric-sql/pglite
cd .. && node SECURITY_AUDIT/harness/verify-prior.mjs    # F-001, F-002 (pre-fix vs post-fix)
node SECURITY_AUDIT/harness/verify-phase2.mjs            # F-008, F-003 + no-over-tightening
node SECURITY_AUDIT/harness/writes.mjs                   # attacker state-change probes
node SECURITY_AUDIT/harness/matrix.mjs                   # full object x role permission matrix
node SECURITY_AUDIT/harness/realtime-race.mjs            # Realtime authz + race conditions
```

`--no-save` is deliberate: PGlite is an audit tool, not a product dependency, and must not enter
`package.json`.

## Files

| File | Purpose |
|---|---|
| `bootstrap.mjs` | Provisions what Supabase provides before any project migration: `anon`/`authenticated`/`service_role` roles, the `auth` schema, `auth.uid()` backed by the same JWT-claims GUC PostgREST uses, a `realtime.messages` surface, Supabase's default grants, and a `pg_cron` stub. |
| `db.mjs` | Applies all migrations in order; `as(db, {role, uid}, sql)` runs a statement with a given identity exactly as a PostgREST request would; `admin()` bypasses RLS for fixtures and ground truth. |
| `fixtures.mjs` | Synthetic identities: alice, bob, admin, banned. Created via `auth.users` so the real `handle_new_user()` trigger builds their profile and progress rows. |
| `verify-prior.mjs` | Runs F-001/F-002 twice — with the fix migration excluded (exploit **must** reproduce) and included (**must** fail). Proving the vulnerability was real matters as much as proving the fix works. |
| `verify-phase2.mjs` | F-008/F-003, each paired with a "legitimate user is unaffected" assertion so a fix cannot pass by breaking the feature. |
| `writes.mjs` | Cross-user/privilege/ban probes graded on **observed state change**, read back with the service role. |
| `matrix.mjs` | Object × role permission matrix across every table, view and RPC. |
| `realtime-race.mjs` | Realtime topic authorization (including membership revocation) plus economy and room-capacity races. |

## Two methodology notes worth keeping

**Grade on state change, not on absence of an error.** An `UPDATE`/`DELETE` that RLS filters to
zero rows raises no error — it simply affects nothing. An early version of `writes.mjs` graded on
"did the statement throw" and reported ~10 false ALLOWEDs. Every probe now reads the row back and
compares before/after.

**Pick attack values that actually exercise the control.** The first F-002 attempt used
`gold = 999999999`, which trips the `user_progress_sane` CHECK (ceiling 1e8) and made the exploit
look blocked when it was not. Re-running at `99000000` — under the CHECK, far above the trigger's
20000 per-write ceiling — reproduced it immediately. A test that passes for the wrong reason is
worse than no test.

## Limits

PGlite covers the database. It does **not** cover GoTrue (JWT issuance/signature verification,
password policy, reset-token entropy, session rotation) or PostgREST's HTTP layer. Those remain
`NOT VERIFIED` and are recorded as such in `FINAL_SECURITY_AUDIT.md`.
