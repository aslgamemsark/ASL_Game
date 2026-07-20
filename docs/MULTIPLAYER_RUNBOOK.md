# Multiplayer Operations Runbook

Operational reference for QuickSign's real-time multiplayer (Duel 1v1 + Room up to 4). Read this
before touching networking, changing a TURN provider, or debugging a "can't connect" report.

## 1. Architecture at a glance

QuickSign multiplayer has **no dedicated game server**. It is peer-to-peer video over WebRTC, with
Supabase Realtime as the signaling channel and a few Supabase RPCs for room lifecycle.

```
Player A  ──(Supabase Realtime broadcast: offer/answer/ICE)──►  Player B
   │                                                                │
   └────────────── WebRTC media (P2P, or relayed via TURN) ─────────┘

Room lifecycle:  multiplayer_rooms table + RPCs (join_multiplayer_room, leave_multiplayer_room)
Signaling:       supabase.channel('mp-room-<code>', { private: true })  — RLS-gated (members only)
Presence:        Supabase Realtime Presence = "who is actually still connected"
ICE config:      web/src/config/iceServers.ts   (STUN-first, TURN fallback, env-driven)
Signaling hook:  web/src/hooks/useMultiplayerSignaling.ts  (game-agnostic plumbing)
Game flow:       web/src/pages/DuelPage.tsx, RoomPage.tsx  (rounds/scores/roles/phases)
```

**Key design points**
- **STUN-first.** The browser only relays through (costly) TURN when direct/reflexive candidates
  fail. STUN is free; TURN is the paid-provider question this runbook exists to answer.
- **Private channels.** `mp-room-<code>` channels use Realtime Authorization — a stranger holding
  the public anon key cannot subscribe without a `multiplayer_room_members` row (RLS). See
  migration `20260718010000_realtime_authorization.sql`.
- **No infinite "Joining…".** `join()` settles its promise on terminal channel states
  (`CLOSED`/`CHANNEL_ERROR`/`TIMED_OUT`), never only on success. Both pages always render an exit
  (Return Home), and both surface a Retry on a channel drop.

## 2. Environment variables (ICE / TURN)

All **optional**. Unset = the built-in free tier (Google STUN + OpenRelay TURN). This is the
current $0 default and needs zero configuration. Override only when analytics justify it (§5).

| Variable | Purpose |
|---|---|
| `VITE_STUN_URLS` | Comma-separated `stun:` URLs. Default: Google STUN. |
| `VITE_TURN_SERVERS` | **Preferred.** JSON array of `RTCIceServer` objects — supports multiple providers + credential rotation. e.g. `[{"urls":"turn:relay.example.com:443","username":"u","credential":"c"}]` |
| `VITE_TURN_URLS` | Shorthand single provider (comma-separated URLs). Used only if `VITE_TURN_SERVERS` is unset. |
| `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | Credentials for the shorthand form. |

Precedence: `VITE_TURN_SERVERS` → `VITE_TURN_URLS`+creds → free OpenRelay default.
These are **build-time** (Vite `VITE_*`), so a change requires a redeploy, not a runtime toggle.

## 3. TURN provider migration (one env change, zero code change)

The app never names a provider — `iceServers.ts` reads env only. To switch providers:

1. Provision TURN with the new provider (Metered / Twilio / Cloudflare / self-hosted coturn).
2. In Vercel → Settings → Environment Variables (Production), set **`VITE_TURN_SERVERS`** to the
   provider's JSON array (URLs + username + credential).
3. Redeploy. Done — no code touched. Verify via the Recognition/Multiplayer analytics (§5) that
   `used_relay` connections now succeed through the new host.

**CSP note:** TURN/STUN traffic is not HTTP and is not governed by `connect-src`, so a new TURN
host normally needs **no** `vercel.json` CSP change. (Only add a host to CSP if a provider requires
an HTTPS credential-fetch endpoint, which OpenRelay/Metered static creds do not.)

**Credential rotation:** update the same env var(s) with the new secret and redeploy. Never commit
TURN secrets — they live only in the deploy environment (the free OpenRelay creds are the sole
hardcoded fallback, and are public by design).

## 4. Common failures & troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| "Connection lost" banner mid-match | This client's Realtime channel dropped (wifi flap, sleep) | The banner's **Retry** re-subscribes. If it persists, the network is down — Leave/Return Home. |
| Both webcams never connect, stuck "Connecting…" | Symmetric NAT on both peers + TURN saturated/unreachable | Check `multiplayer_ice_failed` rate in PostHog. If high, the free TURN is likely overloaded → provision paid TURN (§3). |
| "Camera access denied" in a duel | Browser camera permission denied | Player must allow camera; in-app browsers (Reddit/IG) often block it — open in Safari/Chrome. |
| Can't join a room / "room not found" | Wrong/expired code, or room closed | Codes are case-insensitive; room may have ended. Create a new one. |
| Join silently does nothing | Rate-limited (>10 join attempts/min) | By design (brute-force guard, `room_join_attempts`). Wait a minute. |
| Guesser sees signer's video but signer sees black | One-directional track / role-rotation race | Usually self-heals on next round; if not, both Leave + rejoin. |

**Where to look:** browser console (`[QuickSign]` logs), PostHog `multiplayer_ice_*` events, and
Supabase → Realtime inspector for channel subscribe/deny.

## 5. PostHog: the TURN decision + multiplayer health

Every peer connection emits **one** of:
- `multiplayer_ice_connected` — `{ candidate_type, used_relay, connection_time_ms, used_default_turn }`
- `multiplayer_ice_failed` — `{ reason, used_default_turn }`

**The one question these answer: do we need to pay for TURN?**

| Metric (over `multiplayer_ice_connected`) | Reading |
|---|---|
| `used_relay = true` rate | **The headline.** Share of connections that needed TURN relay. |
| `candidate_type` breakdown | `host`/`srflx` = free direct/STUN; `relay` = went through TURN. |
| `multiplayer_ice_failed` rate | Connections that never established at all. |
| `connection_time_ms` p50/p95 | How slow relay paths are vs direct. |

**Decision criteria:**
- **`used_relay` < ~10% and low `ice_failed`** → free STUN covers you. **Do not pay for TURN.**
- **`used_relay` 30–60% (typical for mobile-heavy traffic) with rising `ice_failed`** → the free
  OpenRelay is a bottleneck. **Provision a paid TURN provider** (§3).
- Segment by `$device_type`/`$browser`: mobile and Safari usually relay more than desktop Chrome.

**Suggested dashboard tiles (Multiplayer):** `used_relay` rate trend · `ice_failed` rate ·
`connection_time_ms` distribution · match started→finished funnel · abandon rate by `mode`.

## 6. Recovery guarantees (verified)

- **No infinite "Joining…":** `join()` resolves on terminal channel states; the header close
  button (Return Home) is always rendered.
- **Duel reconnect:** `waiting-reconnect` phase → Retry (re-join) + Leave, with a countdown.
- **Room channel drop:** a "Connection lost" banner → Retry (re-join) + Leave.
- **ICE failure:** reported to analytics; the user is never frozen — Leave/Return Home always works.

## 7. Emergency kill switch

If multiplayer breaks badly under launch load, flip the **`disable_multiplayer`** PostHog feature
flag ON (rollout 100%). `MultiplayerHubPage` then shows a friendly "temporarily unavailable"
fallback — no redeploy needed. Turn it back off to restore.
