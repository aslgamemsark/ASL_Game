# Threat Model (STRIDE)

## Adversary profile

The realistic attacker here needs **no special position**: the anon key is public in the bundle, signup is free and unrestricted, and there is no server tier to get through. The baseline adversary is *"anyone who can create an account and use `curl`."* Everything the client can do, a script can do, without the UI.

Secondary adversaries: a malicious room participant; a compromised dependency; a curious authenticated user probing PostgREST directly.

## Primary assets, ranked

1. **Live webcam video of users** (potentially minors — the project's own `LAUNCH_CHECKLIST.md` flags COPPA/GDPR-minors as a launch blocker). *Highest-consequence asset in the product.*
2. Account integrity / admin privilege.
3. Hand-landmark data in `sign_attempts` / `training_samples` — biometric-adjacent.
4. Game economy + public leaderboard integrity.
5. User-submitted free text (`feedback`, `user_reports`).

## STRIDE by boundary

### Browser → PostgREST (**the only real boundary**)

| | Threat | Assessment |
|---|---|---|
| **S** | Forge another user's identity | JWT signed by Supabase; `auth.uid()` is server-derived. No app code trusts a client-supplied user id. **Mitigated.** |
| **T** | Tamper with own economy | `guard_progress_deltas` caps UPDATE deltas — but was **bypassable via DELETE+INSERT → F-002**. |
| **T** | Self-promote to admin | `protect_privileged_profile_columns` trigger, verified attached. Profile row always pre-exists (`handle_new_user`) and has **no DELETE policy**, so delete-then-reinsert is impossible. **Mitigated.** |
| **R** | Deny an action | `audit_logs` + triggers on profiles/user_progress/friendships. Partial coverage. |
| **I** | Read another user's data | Most tables owner-scoped. `profiles` and `user_progress` are world-readable by design (leaderboard) — `profiles` over-exposes admin/ban state → **F-003**. |
| **I** | **Read private room codes → join → receive webcam** | `rooms_select_all using (true)` + no visibility check in join → **F-001. The most serious finding.** |
| **D** | Exhaust resources | `join_multiplayer_room` throttles 10/min; `trim_training_samples` caps rows. No global write rate limit → **F-004**. |
| **E** | Call admin RPCs | All 9 verified to enforce `is_admin` and raise. **Mitigated.** |

### Browser → Realtime

Policies correctly restrict challenge topics to the addressee and room topics to `multiplayer_room_members`. **The policy logic is sound** — but it authorizes on *membership*, and F-001 made membership improperly obtainable. A correct policy resting on a corrupted premise.

### Peer → Peer (WebRTC)

Media is browser-to-browser and **never touches the database**. There is no post-connection authorization layer: once you are a peer, you receive video. Access control is therefore entirely upstream, in room membership. This is what converts F-001 from "information disclosure" into "unauthorized live webcam access."

### Supply chain

3 known-vulnerable transitive deps at audit time; all triaged **NOT REACHABLE** at runtime (see F-005). No install scripts from untrusted packages observed. Lockfile committed.

### Client-side / browser

- **XSS:** zero raw HTML sinks in `web/src/` (no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`). React default escaping throughout. **Strong.**
- **Token leakage:** `flowType: 'implicit'` puts auth tokens in the URL fragment; `sanitizeAnalyticsProperties` strips query+fragment from `$current_url`/`$referrer` before PostHog ingestion — added after a real prior incident where a Supabase access token reached a session recording. **Mitigated, and must not be weakened.**
- **Clickjacking:** `X-Frame-Options: DENY` + `frame-ancestors 'none'` — verified live in production.

## Abuse cases considered

| Abuse case | Outcome |
|---|---|
| Join a stranger's private room and watch them on camera | **F-001 — confirmed possible** |
| Mint unlimited gold / top the public leaderboard | **F-002 — confirmed possible** |
| Grant self admin | Blocked (verified) |
| Enumerate who the admins are | **F-003 — possible, anonymously** |
| Read another user's landmark/biometric data | Blocked (owner-scoped) |
| Harvest user emails | Not possible — emails live in `auth.users`, never exposed via PostgREST |
| Payment manipulation | **N/A — no payment system exists.** Gold is earned in-game, never purchased. |
| Coupon/trial reuse | N/A — no coupons, trials, or paid tiers |
| SQL injection | No raw SQL string concatenation reachable from client input; all access via PostgREST parameterisation or `SECURITY DEFINER` functions with typed args |
| SSRF | No server-side URL fetching exists (no server) |
| File upload abuse | No upload feature exists |

## Where the model said to look — and what it found

The model predicted the two highest-value targets would be (a) anything gating webcam access and (b) any control implemented as a trigger, since a trigger only covers the DML events it is attached to. Both predictions produced a confirmed finding: **F-001** (webcam gating) and **F-002** (`BEFORE UPDATE`-only trigger). Scanner-first ordering would have surfaced neither.
