# OX_ALPHA_D3_ERROR_EDGE_STATES.md

**Task:** ASL-D3 · `[REPORT]` Error & edge states — enumerate the app's failure surfaces and verify each
shows honest copy with a working recovery path.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `d13f6cc`, clean) ·
**Method:** static inventory of every failure branch in `src/` + an EXECUTED probe
(`web/e2e-adhoc/probe-error-states.mjs`, 9 checks, run against the production build + preview; final run:
**9/9 PASS**). No code changed.

---

## 1. Failure-surface inventory (static)

| Surface | Where handled | User-visible behavior |
|---|---|---|
| Camera permission denied | useCamera.ts:120-123 → LessonPage.tsx:403, PracticePage.tsx:549, SpeedChallengePage (same trio), DuelPage.tsx:710 | "Camera access denied" card + guidance ("Allow camera access in your browser settings") + recovery control |
| Camera start error (busy/hardware) | useCamera.ts:125-128 | "Camera unavailable" + "Try again, or check that no other app is using it" |
| Camera stalled/muted feed | useCamera.ts:95-110 (`onended`/stall timer, iOS mute gap fix ASL-A7) | "Camera feed isn't showing" + Try again |
| Recognizer load failure | LessonPage/StoryPage recognizer-status branches | "Couldn't load the recognizer" + retry re-attempts MediaPipe load |
| Global offline | OfflineBanner.tsx (app-root mount) + useOnlineStatus | Persistent `role="status"` banner: "You're offline — lessons already downloaded still work, but scores, friends, and multiplayer won't update…" — explains WHY features break, per its header comment |
| Leaderboard fetch failure | LeaderboardPage.tsx:63-75 BoardList error branch | "Couldn't load the leaderboard" + Retry button; in-flight overwrite guard (:238-243) prevents stale-response clobbering |
| Unknown URL route | SPA fallback renders shell (verified by e2e health.spec:61-64 AND this probe) | Non-blank app chrome; no crash page |
| Banned account | App.tsx:261-271 terminal state pre-render | Full-screen honest notice w/ reason; no app flash first |
| Auth modal dismissal | AuthModal via useDialogA11y (Escape/backdrop/focus trap) | Returns to exactly where the user was |
| Empty data states | D2 coverage (firstRun.spec.ts): leaderboard empty board "No one here yet", friends gate, zero quests | Honest empties, not blanks |

## 2. Executed probe results (production build + preview, chromium 390×844)

Final run — **9/9 checks passed**:

1. ✅ unknown route renders shell (textLen=8 > blank threshold)
2. ✅ auth modal closes on Escape (returns cleanly)
3. ✅ leaderboard fetch failure shows honest error card (endpoint aborted → card within timeout)
4. ✅ leaderboard failure offers Retry button
5. ✅ Retry recovers after network returns (endpoint unblocked → board content renders)
6. ✅ offline mid-session keeps app alive (SPA intact, nav functional, textLen=366)
7. ✅ offline banner appears while offline (`role="status"`, named)
8. ✅ offline banner clears on reconnect
9. ✅ camera denied shows honest card + recovery control ("Camera access denied" + Try again visible;
   gUM overridden to reject NotAllowedError via addInitScript before any module captures mediaDevices)

Probe note: check 9 needed a poll-until-card loop rather than a single waitFor — the deny path flips
state asynchronously after the camera-onboarding gate's Allow click (~2–4 s). The canonical suite's
fakecam.spec.ts covers the *success* path; this probe covers the *denied* path, which fakecam cannot
simulate (its whole point is auto-grant).

## 3. Findings

**No gaps found.** Every enumerated surface has (a) specific, non-generic copy that names the actual
problem, (b) a recovery affordance (Retry / settings guidance / automatic reconnect), and (c) for
offline, a global explanation layer instead of per-screen guesses. Two design details worth calling out
as strengths: the OfflineBanner's copy distinguishes what still works offline (cached lessons) from what
won't sync; and camera-error copy differentiates denied vs hardware-busy vs stalled — three distinct user
remedies, not one generic "camera failed".

**Residual risks (out of scope for client-side audit):** Supabase outage mid-multiplayer is surfaced by
RoomPage/DuelPage exit paths but match-integrity under partial connectivity is a server-side concern
(multiplayer.spec.ts runs against local Supabase in CI); no client change warranted.

## 4. Evidence

Probe script committed alongside this report: `web/e2e-adhoc/probe-error-states.mjs`
(re-run: `node e2e-adhoc/probe-error-states.mjs` with any server on :4173 serving `dist/`; exits 0 iff all
checks pass). Companion probes from earlier tasks: `probe-camera-denied.mjs` (isolated camera-denial trace).
