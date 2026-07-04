# Workstream D+E — UI/sound polish + more story content

**Status: done**, scoped deliberately (see "explicitly not done" below rather than half-wiring
something without a clear trigger point).

## Sound
- `web/src/stores/useSettingsStore.ts` (new) — a small, separately-persisted Zustand store
  (`asl-game-settings`) just for `soundEnabled`. Deliberately **not** added to `useUserStore`'s
  `UserProgress` — that type syncs to Supabase, and a local sound preference has no reason to
  round-trip through the server or merge across devices.
- `web/src/hooks/useSounds.ts` — was previously a per-component-local `useRef(true)` with no way
  for any UI to actually mute it (no settings surface existed at all). Now subscribes to the
  shared store via a ref (kept as a ref, not a reactive read, so the five sound `useCallback`s stay
  dependency-free and don't get recreated every toggle).
- Two new cues: `purchase` (wired into `ShopPage`'s buy flow — success and insufficient-gold both
  play something now) and `badgeUnlock` (defined, tested, **not wired anywhere** — see below).
- Mute toggle added to `ProfileTab` ("Me" tab), a visible switch next to a 🔊/🔇 icon.

## Second pass (2026-07-03, later): the same contrast bug, found by reading the code

After the live URL scan found and fixed the `PracticeTab.tsx` card, went back and grepped every
inline `linear-gradient` background in `web/src/` for the same *shape* of bug: a title with no
explicit text color (inheriting the near-white body default) sitting directly on a mid-bright
gradient. Found the exact same `#0F766E → #14B8A6` gradient reused in
`SpeedChallengePage.tsx`'s tier-select cards (Warm Up/Sprint/Blitz all share one markup, all three
affected) — fixed with the identical scrim technique, once, at the shared markup level. Checked
the other two candidates the grep surfaced (`StreakCard.tsx`'s progress-bar fill — no text on top,
fine; `OnboardingFlow.tsx`'s `background-clip: text` logo — same pattern as `TopBar.tsx`'s
"SignUp" wordmark, gradient renders directly against the dark page background, not against
itself, contrast is fine) and left them alone rather than "fixing" things that weren't broken.

**Lesson for future sessions:** when a design-linter flags one instance of a bug class, grep the
codebase for the same underlying pattern (here: `linear-gradient` + missing explicit text color)
rather than assuming it's a one-off. A tool that scans page-by-page will miss reused markup that
just hasn't been navigated to yet.

## Why `badgeUnlock` isn't wired in yet
There's no existing "a badge was just awarded" notification/toast component anywhere in the app —
`checkBadges()` runs deep inside store actions and just silently appends to the `badges` array. A
sound with no accompanying visual context is confusing UX, and building a full badge-toast system
is a materially bigger feature than "add a sound cue." Left as a ready-to-use function rather than
force a fragile integration — a real toast component is a good candidate for [[Decisions-Log]]'s
"further ideas" list.

## XP-gain animation, world-gradient consistency
Both were already handled adequately before this session — `LessonPage.tsx`'s "+10 XP" already
animates in with a delay, and `World.bgGradient` is applied consistently (if narrowly, to the
world-map cards only) across all three worlds equally. No changes made; documenting so a future
session doesn't re-investigate the same non-issue.

## Second story: Coffee Shop — Rush Hour
`COFFEE_SHOP_RUSH_STORY` (`web/src/data/stories.ts`, id `coffee-story-2`) — reuses only
already-verified signs (HELLO/COFFEE/WANT/MORE/THANK_YOU), zero new signs or ML work.

**Required a small routing change**, not just data: `World.storyId` is a single value used for
world unlock/badge identity, and `WorldMap.tsx` only rendered the ONE node matching it as a
clickable "story card." Changed the check to `node.id === selectedWorld.storyId ||
STORIES.some(s => s.id === node.id)` — any lesson node whose id matches a registered story now
renders as a story card. This generalizes to any number of stories per world for free, without
widening `World`'s type or touching its unlock/badge semantics.
