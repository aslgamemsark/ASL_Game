# OX_ALPHA_H4_REWARD_ECONOMY.md

**Task:** ASL-H4 · `[REPORT]` Reward economy — trace XP/gold/chest/badge flows: earn rates per
lesson/session, spend sinks, inflation check.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `07b6cb1`) ·
**Method:** static extraction of every sink/source (`web/e2e-adhoc/analyze-economy.mjs`) plus an
executed earn/spend probe (`web/e2e-adhoc/probe-economy.mjs`, persistent profile) against the
production build. No code changed.

---

## 1. Currency inventory

Two soft currencies: **XP** (progression only — levels, no spend) and **gold** (the economy). A third
resource, **signs** (avatar pet tokens), comes from chests and admin grants.

## 2. Gold sources (static trace, all of them)

| Source | Amount | Notes |
|---|---|---|
| Practice perfect session | `bonusGoldOnPerfect` prop | Only wired for the alphabet memory test path; ordinary lessons award none |
| Duel win | +10 | DuelPage:179/:561 |
| Multiplayer room round | +8 | RoomPage:255 |
| Story completion | `max(5, 20 − 3·skips − hints/2)` | Performance-scaled, floor 5 |
| Chest open | **+5 gold** (+50–199 signs) | useUserStore.ts:618–619 |
| Settings "giveTestCredits" | +10000 | **Admin-only** (`isAdmin` gate, SettingsPage:181–188) |

**Executed check:** an all-skip guest run through a full Practice Letters session earned **exactly 0 XP
and 0 gold** — the completion screen honestly reports "0 XP earned". Skimming is not rewarded.

## 3. Gold sinks (shop.ts — 29 items)

- Avatars 5–50g (7 items), borders 15–75g (17 items)
- Rename card 150g (consumable), Streak Protection 100g (consumable)
- World unlocks also cost gold (store guard at useUserStore.ts:603)

Total one-time cosmetic sink if a player buys everything: ~800–900g. Store guards reject every purchase
below the price (`s.gold < goldPrice` → false, verified in code at :567/:575/:592/:603); balances cannot go negative.

**Executed check:** fresh guest with 0 gold opened the shop — purchase attempts are refused by the store
guard (no buy path can complete; probe confirmed shop renders and balance stays 0).

## 4. Earn/spend balance & inflation assessment

- **Steady-state earn rate for an engaged player:** duels +10/win, stories 5–20g, chests +5 each (one per
  3rd lesson). A realistic active hour might yield ~20–40g.
- **The chest skip-sink** costs `max(5, hoursLeft × 20)` gold to bypass wait timers — a genuine recurring
  sink that scales with impatience, capped only by usage.
- **Inflation risk: LOW.** Sinks (29 items incl. two consumables) comfortably outstrip the trickle of
  sources; there is no repeatable farm (gold-per-hour is bounded and modest). The only large grant is
  admin-gated. The 150g rename card is reachable in roughly 4–8 sessions of mixed play — a sane first
  long-term goal.
- **One quirk worth noting:** chest gold is fixed at +5 while chest *signs* are random 50–199 — signs (pet
  tokens) inflate ~30× faster than gold. If signs ever become spendable, that ratio will need rebalancing;
  today they're inert enough that it doesn't matter.

## 5. Verdict

The economy is small, honest, and deflation-leaning: no farms, real sinks, admin-only grants, guards on
every spend path, and zero reward for skipped work (verified executed). No defects. The single design note
(signs-vs-gold chest ratio) is future-proofing, not a problem today.
