# Threat Model — ASL Game ("SignUp")

_Prepared: 2026-07-06. Scope: the shipping web app (`web/`), its Supabase backend
(`supabase/`), and the local ML/data tooling (`tools/`, `ml/`). Grounded in the actual repo, not
assumptions — every claim below cites a file._

## 1. System overview

A client-side React SPA (Vite, deployed on Vercel per `vercel.json`) that:
- runs ASL sign recognition **entirely in the browser** (MediaPipe + a TF.js model in
  `web/src/engine/`) — no video or landmarks are sent to a server for recognition;
- uses **Supabase** for auth, a Postgres DB (progress, attempts, friendships, training samples),
  and Realtime channels (1v1 multiplayer);
- stores gamification state (gold/signs currency, cosmetics, world unlocks) in
  **`localStorage`** via Zustand (`web/src/stores/useUserStore.ts`), mirroring a subset to
  Supabase.

## 2. Assets (what an attacker wants)

| Asset | Where | Sensitivity |
|---|---|---|
| User account / session | Supabase Auth (JWT) | High |
| Email addresses | `auth.users` (private), **but** usernames are derived from the email local-part (`handle_new_user` trigger) and `profiles` is world-readable | Medium (partial email disclosure) |
| Biometric-ish landmark data | `training_samples.frames` (hand/body geometry sequences) | Medium–High (privacy/legal) |
| Per-user progress & analytics | `user_progress`, `sign_attempts`, personal views | Low–Medium |
| Leaderboard integrity | `weekly_leaderboard` view over `sign_attempts` + `user_progress` | Medium (product trust) |
| In-app currency (gold/signs) | `localStorage` only | Low today, **Critical if ever monetized** |
| Service-role key | **Not in repo** — env-only, local tooling (`tools/export_supabase_samples.py`) | Critical (correctly protected) |

## 3. Trust boundaries

```
                    ┌─────────────────────────────────────────────┐
   UNTRUSTED        │  Browser (attacker fully controls this)     │
                    │  • React app + Zustand store + localStorage │
   webcam ───────►  │  • MediaPipe / TF.js recognition (on-device)│
   (local only,     │  • Supabase JS client (holds ANON key)      │
    never uploaded) └───────────────┬─────────────────────────────┘
                                    │  HTTPS + JWT (anon or user)
        ── TRUST BOUNDARY ──────────┼───────────────────────────────
                                    ▼
                    ┌─────────────────────────────────────────────┐
   SEMI-TRUSTED     │  Supabase (Postgres + Auth + Realtime)      │
   (enforces RLS,   │  • RLS policies are the ONLY server-side    │
    but NO custom   │    authorization — there is no API layer    │
    server logic)   │  • Realtime broadcast channels (P2P relay)  │
                    └───────────────┬─────────────────────────────┘
                                    │  service-role (bypasses RLS)
        ── TRUST BOUNDARY ──────────┼───────────────────────────────
                                    ▼
                    ┌─────────────────────────────────────────────┐
   TRUSTED (local)  │  Developer laptop: ml/ training,            │
                    │  tools/export_supabase_samples.py (svc key) │
                    └─────────────────────────────────────────────┘
```

**Key structural fact:** there is **no backend application server**. The browser talks straight
to Postgres through the Supabase client. That means **Row-Level Security is the entire
authorization layer** — anything RLS doesn't constrain, a hostile client can do. The browser is
fully attacker-controlled; nothing computed there (scores, "passed", currency, peer identity) can
be trusted.

## 4. Attack surfaces & entry points

1. **Supabase REST/PostgREST** (every `supabase.from(...)` call) — authenticated with a public
   anon key or a user JWT. Governed only by RLS.
2. **Supabase Auth** — signup/login/OAuth (`web/src/contexts/AuthContext.tsx`).
3. **Supabase Realtime broadcast** — multiplayer rooms `mp-room-<code>`
   (`web/src/pages/MultiplayerPage.tsx`), 6-char codes.
4. **The client bundle itself** — ships the anon key (by design) and all game logic; fully
   readable/modifiable by any user.
5. **Webcam** — local only; `getUserMedia` in `web/src/hooks/useCamera.ts`.
6. **Static hosting (Vercel)** — response headers, TLS.

## 5. Threat actors

- **Cheating user** (most likely): forges scores, self-grants currency/badges, tops the
  leaderboard. Fully enabled today — see [SECURITY_AUDIT.md](SECURITY_AUDIT.md) VULN-01/07.
- **Curious/abusive peer** in multiplayer: spoofs identity, steals match rewards (VULN-02).
- **Anonymous scraper**: harvests every username (→ partial emails) from the public `profiles`
  table (VULN-03).
- **Cost/DoS attacker**: floods `sign_attempts` / `training_samples` inserts (VULN-06).
- **Supply-chain**: malicious npm dependency (currently `npm audit` = 0 vulns — see
  [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md)).

## 6. Explicitly out of scope / not a vulnerability

- **The anon key in the client bundle is not a leak** — Supabase anon keys are designed to be
  public; they only permit what RLS allows. Confirmed the **service-role** key is never in the
  client or git history.
- **On-device recognition** is a privacy *strength*: raw webcam frames never leave the device
  (`useCamera.ts` + `useAttemptRecorder.ts` keep video in-memory only). The residual privacy issue
  is the derived *landmark* data that IS uploaded (VULN-04), not video.
