# Attack Surface Inventory

There is no custom HTTP API. The externally reachable surface is:

1. Vercel static routes
2. **PostgREST auto-generated endpoints** — one per table/view, derived from the schema
3. **PostgREST RPC endpoints** — one per `GRANT EXECUTE`-ed function
4. Supabase Auth endpoints (`/auth/v1/*`, provider-managed)
5. Supabase Realtime WebSocket
6. WebRTC peer connections

Every row below is reachable by anyone on the internet holding the public anon key (which ships in the bundle) plus, where noted, any valid user JWT — obtainable by signing up.

## 1. Vercel static routes

| Path | Serves | Auth | Notes |
|---|---|---|---|
| `/` | Marketing (`home.html`) or SPA¹ | None | ¹ On the `growth/launch-readiness` branch `/` is marketing; production currently still serves the SPA. |
| `/app`, `/app?start=…` | SPA shell | None | App-level gating is client-side only — not a security boundary. |
| `/asl-alphabet` | Static SEO page | None | |
| `/sitemap.xml`, `/robots.txt`, `/og-image.png`, icons | Static | None | |
| `/<anything extensionless>` | SPA shell (catch-all rewrite) | None | Returns **200 + `text/html`** for any unmatched path — see F-006. |

## 2. PostgREST table endpoints — effective RLS

Effective state after replaying all 36 migrations in order (later `DROP POLICY`/`CREATE POLICY` wins). `anon` = unauthenticated with the public key; `auth` = any signed-up user.

| Table | SELECT | INSERT | UPDATE | DELETE | Risk |
|---|---|---|---|---|---|
| `profiles` | **`using (true)` — anyone** | own | own (+ privileged-column trigger) | *(none — denied)* | **F-003**: exposes `is_admin`/`is_banned`/`ban_reason` to anon |
| `user_progress` | **`using (true)` — anyone** | own | own (delta-capped) | ~~own~~ **removed by this audit** | **F-002** (fixed) |
| `sign_attempts` | own only | own | own | own | OK — public-read correctly dropped in `20260718010000` |
| `training_samples` | own | own | own | own | OK — biometric-adjacent, correctly scoped |
| `sign_verification_log` | own | own | own | own | OK |
| `friendships` | participants | requester | addressee | participants | OK |
| `multiplayer_rooms` | ~~`to authenticated using (true)`~~ → **host/member only** | host | host | host | **F-001** (fixed) |
| `multiplayer_room_members` | own rows | *(via RPC)* | — | *(via RPC)* | OK |
| `room_join_attempts` | RLS on | — | — | — | Throttle state |
| `feedback` | admin | own/anonymous | admin | — | OK |
| `user_reports` | own | own | — | — | OK |
| `world_flags` | `using (true)` + granted to anon | admin RPC | admin RPC | — | Intended — feature flags |
| `audit_logs` | admin | — | — | — | OK |
| `admin_audit_log` | admin | — | — | — | OK |
| `weekly_leaderboard` (view) | granted `anon` | — | — | — | Intended |

## 3. RPC endpoints (`POST /rest/v1/rpc/<fn>`)

| Function | Granted to | Internal guard | Verified |
|---|---|---|---|
| `admin_grant_gold(uuid,int,text)` | authenticated | `is_admin` + raise | ✅ |
| `admin_set_ban(uuid,boolean,text)` | authenticated | `is_admin` + raise | ✅ |
| `admin_set_cosmetic(uuid,text,text)` | authenticated | `is_admin` + raise | ✅ |
| `admin_grant_cosmetics(uuid,text[])` | authenticated | `is_admin` + raise | ✅ |
| `admin_get_user_progress(uuid)` | authenticated | `is_admin` + raise | ✅ |
| `admin_set_world_flag(text,bool,bool)` | authenticated | `is_admin` + raise | ✅ |
| `admin_set_username(uuid,text)` | authenticated | `is_admin` + raise | ✅ |
| `admin_beta_metrics()` | authenticated | `is_admin` + raise | ✅ |
| `admin_analytics(int)` | authenticated | `is_admin` + raise | ✅ |
| `join_multiplayer_room(text)` | authenticated | rate-limit 10/min; **no visibility check** | F-001 |
| `find_public_room(text)` | authenticated | public+waiting only, excludes self | ✅ |
| `leave_multiplayer_room(text)` | authenticated | membership-scoped | ✅ |
| `cleanup_stale_multiplayer_rooms()` | **revoked from all** | — | ✅ |
| `guard_progress_deltas()`, `handle_new_user()`, `protect_privileged_profile_columns()`, `add_host_to_room_members()`, `trim_training_samples()`, `guard_progress_insert()` | **revoked from anon+authenticated+public** | trigger-only | ✅ |

All 9 admin RPCs were verified by extracting each function's **final** definition across all migrations and asserting both an `is_admin` read and a `raise exception` are present — not by trusting the comments that claim it.

## 4. Realtime (WebSocket)

| Topic | Policy | Verified |
|---|---|---|
| `challenge_<uuid>` | SELECT: addressee only; INSERT: friends only | ✅ |
| room topics | SELECT/INSERT: `multiplayer_room_members` membership | ✅ policy correct — but membership itself was obtainable via F-001 |

## 5. WebRTC

Peer-to-peer media, established after Realtime signalling. `useMultiplayerSignaling.ts:161` calls `pc.addTrack(stream)` with the **live local camera stream**; `pc.ontrack` receives the peer's.

**Access control for live video is therefore entirely a function of room-membership authorization** — which is what made F-001 a webcam-exposure issue rather than a metadata one.

## 6. Undocumented / orphaned surface

- No OpenAPI or GraphQL schema is maintained in-repo, so no code-vs-schema drift comparison was possible. PostgREST's own schema endpoint is the de-facto contract.
- Dev-only routes `/avatarlab`, `/calibrate`, `/test-signs` sit behind `import.meta.env.DEV` and are dead-code-eliminated from production builds. **Verified against a production-shaped build**: `avatarlab`, `test-signs`, `AvatarLab` and `LandmarkViewer` return zero matches across `dist/`. The single `calibrate` hit was manually inspected and is a false positive — the word "recalibrate" inside admin-panel guidance copy (`AdminPanel-*.js`), not the route.
- `stripDevOnlyPublicAssets()` (`vite.config.ts`) deletes reference poses, avatar models, landmark fixtures and classifier weights from the deploy artifact post-build. **Verified**: `dist/reference_poses`, `dist/models/avatar`, `dist/dev` and `dist/models/signs` are all absent after build — a real, effective reduction of deployed surface.
