# Architecture — Security View

## The single most important structural fact

**There is no application server.** No edge functions (`supabase/functions/` does not exist), no API routes, no backend service of any kind. The deployable is a static Vite bundle on Vercel's CDN plus static marketing HTML.

This collapses the entire security architecture into one statement:

> **Every authorization decision in this product is made by Postgres — RLS policies and `SECURITY DEFINER` functions. There is no server-side code between the browser and the database.**

The Supabase **anon key is public by design** and ships in the JS bundle. It is not a secret and its exposure is not a finding. It is a routing credential; the JWT attached to a request is the identity, and RLS is the only gate. Anything RLS permits, any user on the internet can do with `curl`.

Practical consequence for this audit: reviewing React code for authorization bugs is nearly worthless — the client is fully attacker-controlled and can be bypassed entirely. **The audit weight belongs almost entirely on `supabase/migrations/`.** That is where it was placed.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite 8 (rolldown), Tailwind, framer-motion, Zustand |
| Routing | Hand-rolled `Screen` discriminated union in `App.tsx` — no router library |
| Hosting | Vercel static + CDN; `vercel.json` supplies rewrites, redirects, CSP/security headers |
| PWA | `vite-plugin-pwa` / Workbox, `registerType: 'autoUpdate'` |
| Auth | Supabase Auth — email/password + Google OAuth, `flowType: 'implicit'` (tokens arrive in the URL **fragment**) |
| Data | Supabase Postgres via PostgREST, accessed directly from the browser |
| Realtime | Supabase Realtime broadcast/presence, gated by RLS policies on `realtime.messages` |
| Media | WebRTC peer-to-peer (`RTCPeerConnection`), STUN + OpenRelay TURN fallback |
| Recognition | MediaPipe WASM, on-device; TF.js classifier currently disabled (`CLASSIFIER_LOAD_ENABLED = false`) |
| Analytics | PostHog (`posthog-js`, dynamically imported) |

## Trust boundaries

```
[ Browser — FULLY UNTRUSTED ]
   │  anon key (public) + user JWT
   ▼
[ Vercel CDN ] ── static assets only, no logic ── not a security boundary
   │
   ▼
╔═══════════════════════════════════════════════════════════╗
║  THE ONLY REAL SECURITY BOUNDARY                          ║
║  Supabase PostgREST → Postgres RLS + SECURITY DEFINER fns ║
╚═══════════════════════════════════════════════════════════╝
   │
   ├── Supabase Auth (auth.users — emails live here, NOT in public schema)
   ├── Supabase Realtime (realtime.messages, RLS-gated)
   └── WebRTC signalling → P2P media (browser-to-browser, bypasses the DB entirely)

[ Third parties — outbound only: PostHog, MediaPipe CDN, geo-IP, TURN ]
```

Two observations that shaped the threat model:

1. **WebRTC media never traverses the database.** Once two peers are connected, camera video flows browser-to-browser. The DB's only role is deciding *who is allowed to become a peer*. That makes room-membership authorization a **media access-control decision**, not merely a data one — which is precisely what F-001 turned out to be.

2. **`flowType: 'implicit'`** places auth tokens in the URL fragment. Fragments are never sent to a server, so server-side redirects cannot inspect them — and any analytics that captures `window.location` risks capturing a live access token. The codebase already handles this (`sanitizeAnalyticsProperties` in `analytics/client.ts`, added after a real prior incident); see F-005.

## Data classification

| Table | Sensitivity | Notes |
|---|---|---|
| `profiles` | Low–Medium | username, `is_admin`, `is_banned`, `ban_reason`. **No email/PII** — emails are in Supabase-managed `auth.users`, not exposed via PostgREST. |
| `user_progress` | Low | Game economy + progress. Publicly readable by design (leaderboard). |
| `sign_attempts`, `training_samples` | Medium | Hand-landmark vectors — biometric-adjacent. Correctly owner-scoped. |
| `multiplayer_rooms` / `_members` | **High (indirectly)** | Room codes gate **live webcam access**. See F-001. |
| `feedback`, `user_reports` | Medium | Free-text user submissions; admin-read only. |
| `audit_logs`, `admin_audit_log` | Medium | Admin-read only. |

## Security controls already present (verified, not assumed)

The codebase shows evidence of prior security work, and the following were **individually verified during this audit** rather than taken on trust:

- All 14 public tables have RLS enabled (1:1 with `CREATE TABLE` count).
- All 9 `admin_*` RPCs re-check `is_admin` internally **and** raise on failure — verified by extracting each function's final body across all migrations, not by reading the comment that claims it.
- `protect_privileged_profile_columns()` blocks self-promotion to admin, and **is actually attached** as a `BEFORE UPDATE` trigger on `profiles`.
- `SECURITY DEFINER` functions pin `search_path` (mitigating function-hijacking).
- Trigger functions are explicitly revoked from `anon`/`authenticated`, not just `PUBLIC` — correctly accounting for Supabase's schema-level default privileges.
- `join_multiplayer_room()` rate-limits (10/min) **before** revealing whether a code exists, avoiding a brute-force oracle.
- Realtime `messages` RLS restricts challenge topics to the addressee and room topics to members.
- No raw HTML sinks anywhere in `web/src/` — zero `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or unsafe redirect sinks.
