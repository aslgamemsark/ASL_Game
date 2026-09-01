# QuickSign — Commercial-Launch Security Report

**Date:** 2026-09-01 · **Target:** ASL_Game / QuickSign (`https://quicksignn.vercel.app`)
**Standard:** OWASP ASVS 5.0 L2 target, L1 mandatory · OWASP Top 10:2025 · API Top 10:2023 · STRIDE

---

## FINAL VERDICT

# ⚠️ CONDITIONALLY READY FOR LIMITED RELEASE

**Not** "reasonably ready for commercial launch" — and the reason is *verification*, not code quality.

Two HIGH-severity authorization bypasses were found and fixed. But **no runtime testing was possible on this machine** (no Docker ⇒ no local Supabase stack), so neither the vulnerabilities nor their fixes were proven by execution. The launch gate in the audit brief requires that important findings be *retested*; they have not been. A fix that has been reasoned about but never run is not yet a fix.

**This verdict converts to READY once one thing happens:** run the authored regression suite against a real stack —

```bash
cd web && npx playwright test e2e/security-rls.spec.ts --config=playwright.multiplayer.config.ts
```

CI already provisions exactly this environment (`ci.yml`'s `multiplayer` job runs `supabase start`), and the suite is now wired into it. **The next pull request will execute these tests automatically.** If they pass, the two HIGH findings are closed and the verdict becomes *reasonably ready for commercial launch*, subject to the non-security launch items in `docs/LAUNCH_CHECKLIST.md` (privacy policy, COPPA/GDPR review, crash monitoring) which remain outstanding and are outside this audit's scope.

---

## Executive summary

QuickSign has **no application server**. It is a static SPA that talks directly to Supabase, which means every authorization decision in the product is made by Postgres RLS policies and `SECURITY DEFINER` functions. The audit weight went there accordingly.

That layer is, on the whole, **well built** — and I verified rather than assumed it: all 14 tables have RLS enabled; all 9 admin RPCs genuinely re-check `is_admin` and raise (confirmed by extracting each function's final body across 36 migrations, not by reading the comments claiming it); self-promotion to admin is blocked by a trigger that is actually attached; `SECURITY DEFINER` functions pin `search_path`; trigger functions are revoked from `anon`/`authenticated` with correct awareness of Supabase's schema-level default grants; and there is not a single raw HTML sink in the entire frontend.

Both real findings came from the same class of defect, and it is a class scanners do not detect: **a control that is individually correct but incomplete at its edges.**

- **F-001** — the Realtime and room-join authorization logic is correct. It authorizes on *membership*. But `rooms_select_all using (true)` let any logged-in user read every private room's join code, making membership improperly obtainable. Because a room member receives peers' WebRTC video (`pc.addTrack` publishes the live camera), this is **unauthorized access to other users' live webcam streams** — the most serious issue found, and materially worse for a product whose own launch checklist flags expected minor users.
- **F-002** — an entire migration exists to cap economy growth per write. It attaches `BEFORE UPDATE` only, while a later migration added a DELETE policy. `DELETE` + `INSERT` performs no UPDATE, so the guard never fires: unlimited gold, every cosmetic, top of the public leaderboard. Neither migration is wrong alone; the hole is in their interaction, which is why diff review missed it.

Equally important is what was **not** found: no SQL injection reachable from client input, no XSS sinks, no leaked credentials in git history or the shipped bundle, no exposed admin surface, no PII in publicly-readable tables (emails live in Supabase-managed `auth.users`), and no privilege-escalation path to admin.

## Findings

| ID | Sev | Title | Status |
|---|---|---|---|
| F-001 | **HIGH** | Private room codes world-readable → unauthorized live webcam access | Fixed, **not retested** |
| F-002 | **HIGH** | Economy guard bypassable via DELETE+INSERT | Fixed, **not retested** |
| F-003 | LOW | `profiles` leaks `is_admin`/`is_banned`/`ban_reason` to anon | Open (recommendation given) |
| F-004 | LOW | No global write rate limit | Accepted risk |
| F-005 | INFO | 3 vulnerable deps — all triaged NOT REACHABLE | Patch recommended |
| F-006 | INFO | Catch-all 200s (scanner false-positive source) | By design |
| F-007 | INFO | Supabase demo JWTs in history | False positive |

No CRITICAL findings. Full detail in `FINDINGS.md`.

## Fixes applied

**`supabase/migrations/20260901120000_security_audit_room_visibility_and_progress_insert.sql`**

1. `rooms_select_all` → `rooms_select_member` (host-or-member scope). Regression risk was checked before changing it: **no direct `.select()` on `multiplayer_rooms` exists anywhere in `web/src/`** — matchmaking and joining both run through `SECURITY DEFINER` RPCs that bypass RLS, and all three write paths use `return=minimal`. Hosting, matchmaking and joining are unaffected.
2. `progress_delete_own` dropped, closing the DELETE+INSERT chain at its root. GDPR erasure is unaffected — deletion still cascades `auth.users → profiles → user_progress`.
3. New `guard_progress_insert()` trigger covering the INSERT path. It **caps rather than zeroes**, deliberately: `useProgressSync` upserts real progress through this same INSERT path when a row is missing, so zeroing would silently wipe a legitimate user's save — a worse bug than the one being fixed.

**Security regression tests** — `web/e2e/security-rls.spec.ts`: non-member cannot read a private room code; host *can* still read their own (guards against over-tightening); client DELETE cannot remove a progress row; INSERT is capped not zeroed; anon can read no rooms; a user cannot self-promote to admin. Wired into `playwright.multiplayer.config.ts` (the only config with a real database) and excluded from the default e2e config to avoid the skip-noise that config's own comment warns about.

**CI security gates** — new `.github/workflows/security.yml` running gitleaks on **every** PR and push with full history. Deliberately a separate workflow: `ci.yml` is path-filtered, and secrets get committed precisely to the unfiltered paths (READMEs, scratch scripts, repo root). `.gitleaks.toml` allowlists the one known false positive (the public `supabase-demo` keys, scoped to a single file) and adds an explicit `service_role` rule — a scanner that cries wolf gets muted, and a muted scanner is worse than none.

The existing scheduled `audit.yml` was left alone: its reasoning for not PR-gating `npm audit` is sound and I saw no reason to override it.

## Retest results

| Check | Result |
|---|---|
| `npx tsc -b` | Clean |
| `npx oxlint` | No new warnings (pre-existing only) |
| `npm run test` (unit) | **777 passed**, 63 files (on `security/audit-2026-09-01`, branched from `main`) |
| `npm run build` | Clean |
| Workflow YAML + `.gitleaks.toml` | Parse-validated |
| **F-001 / F-002 exploit reproduction** | ❌ **Not performed — no runtime environment** |
| **F-001 / F-002 fix verification** | ❌ **Not performed — tests authored, not executed** |

## Coverage

**OWASP Top 10:2025** — A01 Broken Access Control: **primary focus, 2 findings**. A02 Crypto: reviewed (no secrets, TLS+HSTS verified). A03 Injection: reviewed, none reachable. A04 Insecure Design: F-002, F-004. A05 Misconfiguration: headers verified live. A06 Vulnerable Components: `npm audit` + manual reachability triage. A07 Auth Failures: **config-reviewed only, NOT runtime-tested**. A08 Integrity: lockfile + CI review. A09 Logging: audit subsystem reviewed. A10 SSRF: N/A (no server).

**API Top 10:2023** — API1 BOLA: **F-001**. API3 BOPLA: reviewed (mass-assignment blocked by triggers). API5 BFLA: all 9 admin RPCs verified. API6 Sensitive Business Flows: **F-002**. API4 Resource Consumption: F-004. API7 SSRF: N/A. API8 Misconfiguration: verified. API9 Inventory: `ATTACK_SURFACE.md`. API2/API10: partially — auth not runtime-tested.

**ASVS 5.0** — full matrix in `ASVS_5_MATRIX.md`. Substantial portions are honestly marked NOT VERIFIED.

## Known limitations — read this before trusting the verdict

1. **No runtime testing of any kind.** No Docker ⇒ no local Supabase ⇒ no local Postgres. Both findings and both fixes are **code-confirmed only**. This is the single biggest caveat in this report.
2. **No DAST, no API fuzzing, no SQLi confirmation, no SAST.** ZAP, Nuclei, Schemathesis, RESTler, sqlmap, Trivy and testssl.sh were unavailable; Semgrep has no native Windows support and failed to install. `npm audit` and manual review were the automated coverage that actually ran.
3. **Authentication flows were never exercised.** Password policy, reset-token entropy/expiry/single-use, session rotation and revocation, account enumeration — all NOT VERIFIED. For a product handling accounts this is a real gap that a runtime pass must close.
4. **The authorization matrix is analytical, not executed.** It was derived by replaying 36 migrations to compute effective policy state, not by firing cross-user requests with real JWTs.
5. Production received passive requests only — no authenticated testing, correctly per rules of engagement.

## Human actions required

| # | Action | Why |
|---|---|---|
| 1 | **Run `npm run test:multiplayer` (or merge a PR) to execute the RLS regression suite** | The single blocker converting this verdict to launch-ready |
| 2 | Apply migration `20260901120000_…` to production via `supabase db push` | Fixes are inert until deployed |
| 3 | Consider `npm audit fix` | 3 non-reachable deps; non-breaking patch bumps |
| 4 | Decide on F-003 (`public_profiles` view) | Needs a product call on leaderboard/profile shape |
| 5 | Commission a runtime pentest of auth flows before scaling | The largest untested area |
| 6 | Outstanding non-security launch blockers | Privacy policy, COPPA/GDPR-minors review, crash monitoring — see `docs/LAUNCH_CHECKLIST.md` |

**Item 6 deserves emphasis given F-001.** This audit found that strangers could access other users' live webcam streams in rooms believed private. That is fixed in code — but it underlines that the COPPA/GDPR-minors review already sitting open in the project's own launch checklist is not paperwork. For a camera-based product likely to attract minors, it is a launch prerequisite in its own right, and no amount of RLS hardening substitutes for it.

## What I'd tell you in one paragraph

The database layer is better than most I review — the prior hardening work is real, and I verified it rather than taking its word. But two authorization holes existed, both from correct controls with incomplete edges, and one of them exposed live webcam video of users who believed they were in a private room. Both are now fixed, with regression tests that will run on your next PR. Do not treat this as a clean bill of health until those tests actually execute, and do not launch to a broad audience — particularly one including minors — until the auth flows get a runtime pass and the COPPA/privacy review closes.

*Security is never proven by the absence of findings. This report documents what was tested, what was not, and what remains unknown.*
