---
type: moc
---

# Code Map — Web App (the actual screens)

Everything a player sees, and the state it reads/writes. Sits on top of
[[Code-Map-Recognition-Engine]] and [[Code-Map-Signs-Data]].

## State
- `web/src/stores/useUserStore.ts` — the single Zustand store: XP/level/streak, the **dual
  currency** (`signs` — earned per-attempt, spends on skipping a lesson; `gold` — earned from
  quests/badges/streak milestones, spends on shop cosmetics and, as of 2026-07-06, unlocking a
  world early via `unlockWorldWithGold`), badges, quests, chests, cosmetics, friends.
  Persisted to `localStorage` (key `asl-game-progress`).
- `web/src/hooks/useProgressSync.ts` — debounced push/pull of a SUBSET of that state
  (xp/level/streak/completedLessons/signAccuracy) to Supabase `user_progress`, plus one-off
  `logSignAttempt` / `logAttempt` / `logVerification` inserts for telemetry (`sign_attempts`,
  `training_samples`-adjacent, `sign_verification_log`). Gold/signs/cosmetics stay LOCAL ONLY —
  not synced remotely yet.
- `web/src/contexts/AuthContext.tsx` — Supabase auth session; most social/insights features are
  gated on `user` being present.

## Pages (`web/src/pages/`)
- **PracticePage.tsx** — free/weak-sign drilling. Owns the camera loop
  (`useRecognition` + `useAttemptRecorder` for [[Code-Map-Recognition-Engine|replay]]), the
  confidence-gated checklist, and the result/replay phase machine.
- **LessonPage.tsx** — same camera machinery, driven by a fixed lesson's sign list instead of a
  free queue.
- **StoryPage.tsx** — NPC dialogue scenes (`data/stories.ts`) where each line requires signing a
  specific word; escalating hints, per-line XP/signs.
- **SpeedChallengePage.tsx** — timed sign-drill game mode (Warmup/Sprint/Blitz tiers, combo
  scoring).
- **MultiplayerPage.tsx** — real-time 1v1 via Supabase Realtime channels: signer/guesser roles
  alternate over 5 rounds, room-code join.
- **ShopPage.tsx** — cosmetic purchases (`data/shop.ts`) spending `gold`.
- **FriendsPage.tsx** — add/search friends (Supabase `profiles`/`friendships`), see their stats.
- **SettingsPage.tsx** — theme toggle, account/sign-out. Intentionally minimal.
- **HomePage.tsx** — the tab shell (`BottomNav`: Journey / Review / ABCs / Me) hosting:
  - `components/home/WorldMap.tsx` — the world/lesson map, unlock logic
    (`unlockCondition` completedLessons check OR `unlockedWorldIds` gold-unlock), see
    `data/worlds.ts`.
  - `components/home/PracticeTab.tsx` — the "Review" tab (weak-sign practice entry point,
    matches the replay feature's home).
  - `components/home/AlphabetTab.tsx` — fingerspelling letter grid + practice + memory test.
  - `components/home/ProfileTab.tsx` — stats, leaderboard, insights (struggle signs, AI veto
    rate, accuracy sparkline — reads the telemetry `useProgressSync` writes), badges.

## Gamification data (pure data, mirrors [[Code-Map-Signs-Data]]'s pattern)
`data/worlds.ts`, `data/lessons.ts`, `data/quests.ts`, `data/badges.ts`, `data/shop.ts`,
`data/stories.ts` — declarative content the pages above render; no logic lives in these files.
