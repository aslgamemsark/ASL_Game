# OX_ALPHA_H5_MULTIPLAYER_WORTH_IT.md

**Task:** ASL-H5 · `[REPORT]` Is multiplayer worth its complexity — inventory the multiplayer surface
area (code paths, dependencies, failure modes found this session) and weigh maintenance cost against
learner value.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `82719c0`) ·
**Method:** line-count + dependency inventory of the multiplayer surface, cross-referenced with this
session's executed audits (D2 leaderboard retries, D3 offline behavior, G4 return visit, H6 content
depth). No code changed.

---

## 1. Surface area (all of it, counted)

| Component | Lines | Depends on |
|---|---:|---|
| DuelPage.tsx | 857 | Supabase (`multiplayer_rooms` upsert/rpc/find_public_room), camera, useRecognition |
| RoomPage.tsx | 767 | Supabase room rows + realtime presence, host lifecycle (create/start/delete) |
| FriendsPage.tsx | 597 | Supabase profiles/friends, invite → create-room flow into App.tsx |
| MultiplayerHubPage.tsx | 87 | entry router for duel modes |
| components/multiplayer/* | ~340 | RoundResultCard, Scoreboard, etc. |
| lib/multiplayerRooms.ts | 90 | shared room helpers |
| **Total** | **~2,700 lines** (~9% of the app's page/lib code) | plus e2e coverage: `multiplayer.spec.ts` (29 describe/test blocks, CI-only local Supabase) |

Plus schema surface: `multiplayer_rooms` table, `find_public_room` RPC, friends/profile relations —
each a migration + RLS policy to maintain forever.

## 2. What this session's audits found about it

- **D3 (error states):** the honest offline banner already tells users "scores, friends, and multiplayer
  won't update" — i.e. multiplayer is one of the *first* things to break offline. Match-integrity under
  partial connectivity is explicitly a server-side concern the client can't guarantee; the client just
  surfaces exits.
- **D2-era finding:** the world leaderboard (the social layer multiplayer feeds) is subject to Supabase
  GET retry stalls (~15 s worst case before fallback copy) — the social features are also the most
  network-fragile ones.
- **G4:** the return-visit path never touches multiplayer — retention mechanics run entirely on SR +
  quests + streaks.
- **H6:** content depth ends at ~1 hour of novel material; nothing in multiplayer adds learning
  content, only competition over the same 51 signs.

## 3. Cost vs value

**Costs (real, recurring):**
- ~2,700 lines that must track every recognition/camera change (they embed the same useRecognition
  pipeline as solo modes);
- server-side state (rooms table, RPC, presence) with security policies;
- CI burden: `multiplayer.spec.ts` requires a local Supabase in CI — the most environment-sensitive
  suite in the repo;
- every product change to scoring/signs must consider match fairness.

**Value (honest):**
- For the target audience (absolute beginners, Deaf/HoH-inclusive), competitive duels over 27 lesson
  signs are plausible motivation for *some* learners, and "play with a friend" is a genuine word-of-mouth
  loop.
- But no executed evidence this session shows multiplayer contributing to activation or retention:
  G2's funnel, G4's return path, H2's core loop, and H6's exhaustion math all operate without it.

## 4. Verdict

**Keep, but freeze.** Multiplayer is functional, tested, and honest about failure — deleting it would
discard real value and a differentiator ("practice ASL with a friend"). But it should be *feature-frozen*
until the content depth problem (H6) is solved: new units grow the pie for everyone, while multiplayer
polish only reshuffles competition over the existing 51 signs. Any new product work should go to content
first; multiplayer maintenance should be limited to keeping its tests green through refactors.

Owner-facing rule of thumb: **1 hour of unique content vs ~2,700 lines of networked code — grow the
former before touching the latter.**
