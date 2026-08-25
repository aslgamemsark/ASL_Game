# OX_ALPHA_D4_NAVIGATION_GRAPH.md

**Task:** ASL-D4 · `[REPORT]` Navigation graph — every screen's entry points, exit affordances, and
reachability verdicts (the class of defect where Leaderboard/Friends were once unreachable on every phone).
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` · **Method:** static trace of `web/src/App.tsx`
(the single router; there is no URL routing — `Screen` is a discriminated union at App.tsx:63-77) with every
entry/exit verified to a file:line. Dynamic behaviors (hardware Back) cross-checked against the executed e2e
suite (`navigation.spec.ts`, 12 cases green this session). No code changed.

---

## 1. Router shape

- **15 screen types** in the `Screen` union (App.tsx:63-77): `home`, `onboarding`, `lesson`, `practice`,
  `story`, `speed`, `shop`, `friends`, `multiplayer`, `settings`, `leaderboard`, `admin`, `privacy`,
  `user-profile`, plus the banned-account terminal state (App.tsx:261-271).
- **No history-based navigation** except dialogs: `useBackDismiss` (App.tsx:156-159) pushes exactly one
  synthetic history entry while any non-home/non-onboarding screen is up, so hardware/browser Back replays
  that screen's own exit action (home for everything except Privacy → Settings). Onboarding and Home are
  deliberately excluded — Back there exits the app/tab, which is correct for the true root.
- **Initial screen** = `onboardingComplete ? home : onboarding` (App.tsx:104); signed-in users with an
  incomplete onboarding are re-routed into it (App.tsx:117-122).

## 2. Global entry surfaces

| Surface | Where | Reaches |
|---|---|---|
| SideNav (≥768px) | SideNav.tsx:31-39 rows → handlers :57-67 | home tabs, Leaderboard, Multiplayer, Friends, Review (home/review/alphabet/basicSigns are Home tabs, not screens) |
| BottomNav (<768px) | BottomNav.tsx:22-25,43 | Journey / Alphabets / Basics / Review / Me — five learning tabs only |
| TopBar avatar | TopBar.tsx:95-108 (`aria-label` = "My Profile" or "Sign in") | guest → AuthModal; signed-in → Me tab |
| TopBar cart | TopBar.tsx:195-206 (`aria-label="Open shop"`) | Shop (only Shop entry outside ProfileTab's Explore grid) |
| Me tab "Explore" grid | ProfileTab.tsx:134-140 | Leaderboard, Friends, Multiplayer, Shop, Settings cards |
| Incoming challenge | App.tsx:562 | Multiplayer duel w/ autoJoinCode |
| Friend challenge send | App.tsx:199-228 via FriendsPage `onChallengeFriend` | Multiplayer duel as host (autoHostRoomId) |

SideNav's Settings row lives below NAV_ITEMS (SideNav.tsx:143+ block); its profile chip (SideNav.tsx:92-104)
mirrors TopBar avatar behavior. Shop is intentionally absent from SideNav rows (comment at SideNav.tsx:28-30)
— it is TopBar-cart + Explore-grid + quest/chest flows only.

## 3. Per-screen map (entry points → exit affordances)

Format: **screen** ← entries; exit(s). All exits verified against the rendered component.

1. **home** ← initial post-onboarding; `goHome()` from every screen (App.tsx:148); SideNav/BottomNav tab
   switches call `goHome(); setHomeTab(...)` (App.tsx:333-336). Exits: the four Home tabs' internal CTAs +
   Speed Challenge card (HomePage.tsx:142-143), StartJourneyCard → WorldMap scroll (HomePage.tsx:131),
   lesson nodes/practice/story entries via HomePage props (App.tsx:368-377).
2. **onboarding** ← fresh install (App.tsx:104), signed-in-but-incomplete redirect (App.tsx:138),
   `startAt:'auth'`. Exit: completion only (App.tsx:167-170 routes by skill level). Back is excluded from
   useBackDismiss by design.
3. **lesson** ← WorldMap LessonNode onSelect (WorldMap.tsx:245→241-246) via HomePage `onStartLesson`.
   Exit: HeaderBackButton/close during session, intro Cancel, results "Continue" (LessonPage.tsx:291,299,551);
   hardware Back → goHome.
4. **practice** ← Review tab (PracticeTab, HomePage.tsx:188-189), letter/sign detail "Try Yourself"
   (AlphabetTab.tsx:128, BasicSignsTab.tsx:116), "Test from Memory" quizzes (HomePage.tsx:204-211,226-233),
   weak-sign practice. Exit: header back stops cam+loop then exits (PracticePage.tsx:381), results
   "Back to Home" (:727); hardware Back → goHome.
5. **story** ← WorldMap story-node button (WorldMap.tsx:207). Unknown storyId renders null (App.tsx:406-407)
   — but story ids come from the static STORIES registry, not user input. Exit: close button stops cam+loop
   (StoryPage.tsx:189), end-card "Back to Home" (:423-424).
6. **speed** ← Journey tab Speed Challenge card (HomePage.tsx:143). Exit: header back stops cam+loop
   (SpeedChallengePage.tsx:247), end-of-run exit (:498).
7. **shop** ← TopBar cart (TopBar.tsx:198), Explore grid card (ProfileTab.tsx:134). Guest-permitted.
   Exit: HeaderBackButton (ShopPage.tsx:75,91).
8. **friends** ← Explore grid (ProfileTab), SideNav Friends row. Guest → gate page w/ Close + Sign In
   (FriendsPage.tsx:303-315). Signed-in exits: back (:326), plus deep-links onward: challenge → multiplayer
   duel host (App.tsx:430), view profile → user-profile (App.tsx:431).
9. **multiplayer** ← Explore grid, SideNav row, friend-challenge (host, App.tsx:226), incoming challenge
   (joiner, App.tsx:562). Guest gate w/ Close (MultiplayerHubPage.tsx:50-65). Inside: DuelPage/RoomPage
   both exit via close buttons (DuelPage.tsx:650, RoomPage.tsx:601,650) and auto-exit on match end
   (DuelPage.tsx:618, RoomPage.tsx:587).
10. **settings** ← Explore grid card, SideNav Settings row. Exit: HeaderBackButton (SettingsPage.tsx:52);
    forwards: Admin (admins only, App.tsx:453), Privacy (App.tsx:454).
11. **leaderboard** ← Explore grid, SideNav row. Exit: HeaderBackButton; forwards: user-profile for any row
    (LeaderboardPage.tsx:119 → App.tsx:469).
12. **user-profile** ← leaderboard rows (App.tsx:469) and friends lists (App.tsx:431; FriendsPage.tsx:389,437).
    Exit: HeaderBackButton → goHome (UserProfilePage.tsx:122). Deliberately does NOT return to origin
    (comment App.tsx:474-479) — matches the global "exit goes home" convention.
13. **privacy** ← Settings only (App.tsx:454). Exit: HeaderBackButton → **Settings**, not home
    (App.tsx:458-461) — the one non-home exit target, mirrored by hardware Back (App.tsx:158).
14. **admin** ← Settings row rendered only when `isAdmin`; render also guarded `screen.type==='admin' &&
    isAdmin` (App.tsx:488). Defense-in-depth per comment: hidden UI ≠ security boundary; RPCs re-check
    server-side. Exit: HeaderBackButton (AdminPanel.tsx:91).
15. **banned terminal state** ← replaces whole app pre-render when `bannedReason` set (App.tsx:261-271);
    account force-signed-out client-side, RLS denies server-side. No exits by design.

## 4. Reachability verdicts

- **No orphan screens.** All 15 union members have ≥1 live entry point; all render paths have ≥1 exit.
  The historical D-class bug (Leaderboard/Friends unreachable on phones) stays fixed: both are Explore-grid
  cards + SideNav rows (ProfileTab.tsx:134-136, SideNav.tsx:35,37), and e2e asserts them on phone width.
- **No dead ends.** Every reachable state has a visible exit affordance AND hardware Back mapped to the same
  destination (useBackDismiss covers all 12 non-root screens; verified by navigation.spec.ts's 12 passing
  cases including double-back exhaustion and dialog-close cases).
- **Guest vs signed-in asymmetry is deliberate and gated honestly**: Friends/Multiplayer render full gate
  pages for guests (never silent empty lists), Shop/Leaderboard/Settings are guest-reachable.
- **Two structural quirks, both documented in-code, neither a defect**:
  1. Privacy→Settings is the only non-home back target; everywhere else exits to home. Consistent with its
     single fixed parent; user-profile is multi-origin so it correctly does NOT track origin.
  2. SideNav carries no Shop row by design (TopBar cart + Explore grid cover it); the `handlers` map still
     contains `shop:` (SideNav.tsx:62) which is unused by NAV_ITEMS — dead-ish but typed-complete, kept so
     the Record<SideNavScreen,…> typechecks. Cosmetic at most.

## 5. Evidence of execution

- Static trace performed this session against working tree at commit `5c5ab9f` (clean).
- Behavioral cross-check: canonical e2e suite run this session — **158 passed / 4 skipped / 0 failed**
  across chromium/android/ios, including `navigation.spec.ts` (12 hardware-Back cases),
  `explore.spec.ts` (Explore grid reachability incl. guest gates), and `firstRun.spec.ts` (zero-state walk).
