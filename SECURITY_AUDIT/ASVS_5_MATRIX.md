# ASVS 5.0 Verification Matrix (L1 / L2)

**Method:** white-box source + schema review, dependency and secret scanning, passive production header checks.
**Not used:** DAST, API fuzzing, runtime authorization testing — no local/staging environment could be built (no Docker).

`PASS` requires evidence recorded below. **`NOT VERIFIED` is never upgraded to `PASS` on the basis that the code "looks right."** A large number of requirements below are `NOT VERIFIED` precisely because they can only be established by running the application.

Legend: **P** = Pass · **F** = Fail · **N/A** = Not applicable · **NV** = Not verified

## V1 — Encoding & Sanitization

| Req | L | Status | Evidence |
|---|---|---|---|
| V1.2.1 Output encoding contextual | 1 | **P** | Zero raw HTML sinks in `web/src/` — no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval`, `new Function`. React default escaping throughout. |
| V1.2.2 Injection-safe DB access | 1 | **P** | No client-reachable raw SQL concatenation. All access via PostgREST parameterisation or `SECURITY DEFINER` functions with typed arguments. |
| V1.2.4 OS command injection | 1 | **N/A** | No server-side command execution — no server. |
| V1.3.x Deserialization | 2 | **N/A** | No custom deserialization; JSON only. |
| V1.5.x SSRF defenses | 2 | **N/A** | No server-side URL fetching exists. |

## V2 — Validation & Business Logic

| Req | L | Status | Evidence |
|---|---|---|---|
| V2.1.1 Server-side validation | 1 | **P** | Enforced in Postgres: `CHECK` constraints on `visibility`/`mode`/`status`, `profiles_username_format`, economy ceilings in `guard_progress_deltas`/`guard_progress_insert`. Not client-trusted. |
| V2.2.1 Business-logic limits | 2 | **P** *(after fix)* | Economy ceilings enforced on **both** UPDATE and INSERT. Was **FAIL** — see F-002. |
| V2.2.2 Anti-automation | 2 | **F** | No global write rate limit — F-004, accepted risk. Room joins throttled (10/min). |
| V2.3.1 Workflow sequencing | 2 | **F→P** | F-002 was exactly a workflow-sequencing bypass (DELETE+INSERT skipping the UPDATE guard). Fixed, **not runtime-verified**. |

## V3 — Web Frontend Security

| Req | L | Status | Evidence |
|---|---|---|---|
| V3.4.1 Cookie security | 1 | **N/A** | No app cookies; Supabase session in `localStorage`. |
| V3.4.2 CSRF defenses | 1 | **N/A** | No cookie-based auth ⇒ no ambient authority. Bearer JWT only. |
| V3.5.1 CSP present | 2 | **P** | Verified live: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`. |
| V3.5.2 CSP avoids `unsafe-inline` script | 2 | **F** | App CSP uses `'wasm-unsafe-eval'` (required by MediaPipe WASM — justified); marketing CSP uses `'unsafe-inline'` for `script-src` (inline PostHog snippet + auto-continue script). Nonce/hash would be stronger. |
| V3.7.1 Clickjacking | 1 | **P** | `X-Frame-Options: DENY` + `frame-ancestors 'none'` — verified live. |

## V6 — Authentication

| Req | L | Status | Evidence |
|---|---|---|---|
| V6.1.x Password security | 1 | **NV** | Delegated to Supabase Auth (bcrypt). Provider default not independently verified. |
| V6.2.x Credential recovery | 1 | **NV** | Supabase-managed reset flow. Token entropy/expiry/single-use **not tested** — requires runtime. |
| V6.3.x Session binding | 1 | **NV** | JWT via Supabase. Rotation-on-auth and revocation-on-signout **not tested at runtime**. `resetIdentity()` clears analytics identity on sign-out. |
| V6.4.1 Account enumeration | 2 | **NV** | Untested. Note: `profiles.username` is publicly enumerable by design (leaderboard). |
| V6.5.x MFA | 2 | **N/A** | Not implemented; not required for this product tier. |

## V8 — Authorization

| Req | L | Status | Evidence |
|---|---|---|---|
| V8.1.1 Enforced server-side | 1 | **P** | 100% in Postgres RLS. Client cannot be trusted and is not relied upon. |
| V8.2.1 Least privilege | 2 | **F→P** | Was FAIL: `rooms_select_all using (true)` (F-001). Fixed to host-or-member. |
| V8.3.1 Object-level authorization (BOLA) | 1 | **F→P** | F-001 was a genuine BOLA with live-video impact. Fixed, **not runtime-verified**. F-003 (over-broad `profiles` read) remains **open**. |
| V8.4.1 Function-level authorization | 1 | **P** | All 9 `admin_*` RPCs verified to read `is_admin` **and** `raise exception` — established by extracting each function's final body across all 36 migrations, not by trusting comments. |
| V8.4.2 Privilege escalation blocked | 1 | **P** | `protect_privileged_profile_columns` trigger verified **attached** (`BEFORE UPDATE ON profiles`). Profile row always pre-exists and has **no DELETE policy**, so delete-then-reinsert is impossible. |

## V10 — Cryptography / V11 — Communications

| Req | L | Status | Evidence |
|---|---|---|---|
| V10.x Key management | 2 | **P** | No secrets in source or history. Anon key is public by design. No real `service_role` key committed. |
| V11.1.1 TLS enforced | 1 | **P** | HTTPS only; `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` verified live. |
| V11.1.2 TLS configuration strength | 2 | **NV** | `testssl.sh`/SSLyze not available. Vercel-managed TLS not independently profiled. |

## V7 — Logging

| Req | L | Status | Evidence |
|---|---|---|---|
| V7.1.1 Security events logged | 2 | **P** | `audit_logs` + triggers on `profiles`, `user_progress`, `friendships`; `admin_audit_log` for admin actions. |
| V7.1.3 No sensitive data logged | 1 | **P** | `sanitizeAnalyticsProperties` strips query + fragment from `$current_url`/`$referrer` before PostHog ingestion — added after a real incident where a Supabase access token reached a session recording. Session replay masks all inputs. |
| V7.2.1 Log integrity | 2 | **P** | `audit_logs` is admin-read-only; no client write path. |

## V13 — Configuration / Dependencies

| Req | L | Status | Evidence |
|---|---|---|---|
| V13.2.1 Dependencies current | 2 | **F** | 3 known-vulnerable transitive deps, all triaged **NOT REACHABLE** at runtime (F-005). Patch recommended, not blocking. |
| V13.3.1 Security headers | 1 | **P** | CSP, HSTS, XFO, `nosniff`, Referrer-Policy, Permissions-Policy — all verified live. |
| V13.4.1 No debug in production | 1 | **P** | Dev routes dead-code-eliminated (verified: zero matches for `avatarlab`/`test-signs`/`AvatarLab`/`LandmarkViewer` in `dist/`); `stripDevOnlyPublicAssets()` removes dev assets (verified absent post-build). |

## Explicitly NOT VERIFIED

Every item here requires a running environment that could not be created:

- **All of V6** beyond configuration reading — password policy, reset-token entropy/expiry/single-use, session rotation and revocation, account enumeration.
- Runtime confirmation of **F-001 and F-002** and of their fixes.
- Any DAST coverage (ZAP), known-vulnerability scanning (Nuclei), API fuzzing (Schemathesis/RESTler), SQLi confirmation (sqlmap), SAST (Semgrep — no Windows support), container/IaC scanning (Trivy/Checkov), TLS profiling (testssl.sh).
- The authorization matrix was constructed **analytically** from policy source, not by executing cross-user requests with real JWTs.
