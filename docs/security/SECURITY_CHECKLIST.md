# Security Checklist — pre-production

_Companion to [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Tick these before real users / any
monetization. `[ ]` = todo, `[x]` = verified done, `[~]` = partial._

## Authentication
- [x] Uses Supabase Auth primitives (no homemade crypto/JWT/hashing)
- [x] OAuth `redirectTo` is `window.location.origin` (no open redirect)
- [x] Sessions persist + auto-refresh via SDK
- [ ] **⚠ Verify email confirmation is required** (Supabase dashboard)
- [ ] **⚠ Verify leaked-password protection + auth rate limits are on** (dashboard)
- [ ] Password-reset flow exists and tested (not present in code yet)
- [x] Graceful handling of the username-uniqueness race (VULN-08) — `AuthContext.tsx` maps 23505 → "Username already taken"

## Authorization (RLS is the whole layer — treat it as such)
- [x] RLS enabled on every table (`profiles`, `user_progress`, `sign_attempts`, `friendships`, `training_samples`)
- [x] Own-row policies `auth.uid() = user_id` correct
- [x] Analytics views use `security_invoker = true` (no cross-user leak)
- [x] Personal views granted to `authenticated` only; only leaderboard to `anon`
- [~] **Score-affecting writes moved server-side** (VULN-01) — PARTIAL: CHECK constraints added (`user_progress_sane`), but full server-authoritative writes still need an Edge Function/RPC (not done — needs a backend)
- [ ] Direct client INSERT/UPDATE on `sign_attempts`/`user_progress` revoked in favor of an RPC/Edge Function

## Database
- [x] No secrets in schema/migrations
- [x] Idempotent, re-runnable migration
- [ ] Reconcile the deployed DB against the committed migration (prod had extra tables/views)
- [x] Sanity `CHECK` constraints on numeric progress (`xp >= 0`, etc.) — migration `20260706120000_security_hardening.sql`
- [ ] **⚠ Confirm no public storage buckets** (dashboard)

## Secrets
- [x] No API keys / tokens / private keys committed
- [x] Service-role key is env-only, documented "never in client"
- [x] `.env.local` gitignored; no secret files in git history
- [x] Anon key in client bundle understood as by-design (not a leak)

## Frontend
- [x] No `dangerouslySetInnerHTML` / `eval` / `new Function` / `innerHTML`
- [x] React auto-escaping is the only render path
- [x] `localStorage` holds only non-secret prefs
- [x] Add security headers / CSP (VULN-05) — `vercel.json` block ⚠ **must be tested on a real Vercel deploy** (dev doesn't apply it)

## Multiplayer / Realtime
- [ ] **⚠ Enable Realtime broadcast authorization** (channel RLS) — VULN-02
- [x] Longer random room codes — 8 crypto-random chars (was 6 `Math.random()`); full UUID deferred until channel auth lands
- [ ] Match rewards awarded server-side, not client-side (needs Edge Function)
- [ ] Peer identity taken from JWT, not self-declared payload (needs channel auth)

## Privacy (biometric-adjacent data)
- [x] Make training-data collection **opt-in** (VULN-04) — store + DB default now `false`
- [x] Rewrite consent copy: data type, purpose (incl. commercial), sharing, retention — `ProfileTab.tsx`
- [ ] Add "delete my training data" path
- [ ] Legal review for BIPA/GDPR before real users (landmark = possible biometric)
- [x] Raw webcam video / replay never leaves device (in-memory only)

## Infrastructure / headers (Vercel) — all in `vercel.json`, ⚠ verify on real deploy
- [x] `X-Frame-Options: DENY` / `frame-ancestors 'none'`
- [x] `Content-Security-Policy` (origins matched to jsdelivr WASM + googleapis models + Supabase; **test OAuth + model load on deploy**)
- [x] `Strict-Transport-Security`
- [x] `X-Content-Type-Options: nosniff`
- [x] `Permissions-Policy: camera=(self), microphone=()`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`

## Rate limiting / abuse
- [x] Per-user insert budget on `sign_attempts` / `training_samples` (VULN-06) — BEFORE INSERT triggers, migration `20260706120000`
- [x] Basic frame-shape validation before training rows are accepted (poisoning guard) — `training_samples_frames_shape` CHECK

## Economy (do BEFORE monetizing)
- [ ] Move `gold`/`signs`/cosmetics/world-unlocks to an authoritative server wallet (VULN-07)
- [ ] Transactional purchase RPC; never trust client-reported balance

## Dependencies / CI
- [x] `npm audit` = 0 vulnerabilities
- [ ] Add `npm audit` + `npm ci` to CI (fail build on new advisory)
- [ ] Dependabot/Renovate for security updates
- [ ] Pin CDN origins for MediaPipe/TF.js WASM + model assets in CSP
