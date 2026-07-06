# Remediation Roadmap — prioritized

_Companion to [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Ordered by (impact ÷ effort), tuned for the
app's *actual* stage: a pre-launch beta with no monetization yet._

## Security score

Weighted for "no-backend SPA where RLS is the whole authz layer." Scores reflect current state.

| Domain | Score /100 | One-line justification |
|---|---:|---|
| **Authentication** | 80 | Solid Supabase primitives; loses points only on unverified dashboard settings + missing password-reset. |
| **Authorization (RLS)** | 70 | Access-control RLS is correct and complete; but it validates *ownership only*, so scores/writes are forgeable (VULN-01). |
| **Database** | 75 | Clean schema, good `security_invoker` views; needs value constraints + prod/migration reconcile. |
| **Frontend** | 85 | No XSS sinks, safe render path; loses points only for missing CSP/headers. |
| **Backend / API** | 55 | There *is* no backend — the client-authoritative model (VULN-01/02/06) is the core weakness. |
| **AI** | 90 | No LLM/prompt surface; recognition is on-device math + a veto model. Minimal AI attack surface. Not a chatbot — no prompt-injection vector. |
| **Infrastructure** | 55 | No security headers/CSP; TLS via Vercel is fine. |
| **Privacy** | 60 | Video stays on-device (good), but biometric-ish landmarks are uploaded opt-out with weak consent (VULN-04). |
| **Overall** | **~68 / 100** | Genuinely good hygiene for a 2-dev project; the ceiling is set by the no-server/client-trust architecture, which is fine for a free beta and must change before competitive stakes or money. |

## Phase 0 — before inviting ANY external testers (hours, not days)
_Cheap, high-value, no architecture change._
1. **Add security headers to `vercel.json`** (VULN-05) — copy the block from the audit, then
   smoke-test that MediaPipe/TF.js and Google OAuth still work under the CSP.
2. **Make training-data collection opt-in + fix consent copy** (VULN-04) — flip
   `collect_training_data` default to `false`, reword the toggle, surface it during onboarding.
   This is the one with real legal weight once strangers are involved.
3. **⚠ Verify the 4 dashboard settings** (email confirmation, realtime auth, leaked-password
   protection, no public buckets) — 10 minutes in the Supabase console, could change severities.

## Phase 1 — before the leaderboard/multiplayer are a selling point (days)
_Requires writing server-side logic (Edge Functions / RPC) — the first real architecture work._
4. **Server-authoritative score writes** (VULN-01) — RPC/Edge Function owns
   `sign_attempts`/`user_progress` writes; revoke direct client write; add `CHECK` constraints.
5. **Fix multiplayer integrity** (VULN-02) — enable Realtime channel authorization, long random
   room codes, server-awarded rewards, JWT-derived identity.
6. **Rate-limit inserts + poisoning guard** (VULN-06) — per-user budget on
   `sign_attempts`/`training_samples`.

## Phase 2 — before monetization or competitive stakes (larger)
7. **Server-authoritative economy** (VULN-07) — wallet + transactional purchases server-side.
8. **Decouple public identity from email** (VULN-03) — neutral generated handles; restrict
   `profiles` base-table reads.
9. **Legal review** — BIPA/GDPR for landmark data; WLASL/ASL-Citizen commercial licensing
   (`docs/LICENSING_CHECKLIST.md`).

## Phase 3 — ongoing hygiene
10. CI `npm audit`/`npm ci` gate; Dependabot; pin CDN origins in CSP; add password-reset flow;
    reconcile deployed DB vs. committed migration; add a "delete my data" path.

## The one-sentence version
**For a free beta with friends: do Phase 0 (an afternoon) and you're in good shape.** The
client-trust issues (Phase 1) only start to bite when the leaderboard/multiplayer actually matter
to someone, and the economy/legal items (Phase 2) only when money or public scale arrive — so
they're correctly deferrable, not ignorable.
