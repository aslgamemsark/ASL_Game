# Analytics Coverage Report

Generated at the end of the PostHog analytics implementation (2026-07-19/20). Live-verified: a
real browser session hit `screen_viewed`, `onboarding_step_viewed`, `ai_model_unavailable`, and
`$groupidentify`, confirmed arriving in PostHog with correct properties and session
super-properties (`app_version`, `git_commit`, `deployment_environment`) via a live HogQL query.

## Files created (26)

**Analytics module** (`web/src/analytics/`): `client.ts`, `events.ts`, `types.ts`, `capture.ts`,
`consent.ts`, `featureFlags.ts`, `useFeatureFlag.ts`, `useScreenView.ts`, `useAnalytics.ts`,
`AnalyticsIdentityBridge.tsx`, `buildInfo.d.ts`, `index.ts`.

**Tests** (`web/src/analytics/tests/`): `capture.test.ts`, `consent.test.ts`, `client.test.ts`,
`events.test.ts`, `noDirectCapture.test.ts` (15 tests total).

**Docs** (`docs/analytics/`): `ARCHITECTURE.md`, `EVENT_REFERENCE.md`, `DASHBOARD_GUIDE.md`,
`FUNNELS.md`, `DEVELOPER_GUIDE.md`, `NAMING_CONVENTION.md`, this file.

## Files modified (26)

`main.tsx`, `App.tsx`, `vite.config.ts`, `vercel.json`, `.env.example`, `public/landing.html`,
`e2e/health.spec.ts`, `contexts/AuthContext.tsx`, `components/onboarding/OnboardingFlow.tsx`,
`components/shared/FeedbackModal.tsx`, `hooks/useCamera.ts`, `hooks/useClassifier.ts`,
`hooks/useRecognition.ts`, `hooks/useMultiplayerSignaling.ts`, `lib/errorReporting.ts`,
`stores/useUserStore.ts`, `data/lessons.ts`, `data/worlds.ts`, `pages/LessonPage.tsx`,
`pages/PracticePage.tsx`, `pages/StoryPage.tsx`, `pages/SpeedChallengePage.tsx`,
`pages/DuelPage.tsx`, `pages/RoomPage.tsx`, `pages/MultiplayerHubPage.tsx`, `pages/ShopPage.tsx`,
`pages/SettingsPage.tsx`, `pages/PrivacyPage.tsx`.

## Events implemented: 40 ACTIVE + 5 FUTURE

See `EVENT_REFERENCE.md` for the full taxonomy with properties. Two real bugs were found and
fixed by the build-mode typecheck (`tsc -b`, not the shallower `tsc --noEmit`) during this work:
a variable-shadowing TDZ bug in `FeedbackModal.tsx`, and a TS closure-narrowing issue in
`useUserStore.ts`'s streak tracking — both fixed and reverified.

## PostHog assets created (live, verified via the connector)

- **11 feature flags**: 6 rollout (`framing_gate`, `hand_skeleton`, `new_multiplayer_ui`,
  `new_onboarding`, `new_shop`, `mascot_variant`) + 5 kill switches (`disable_camera`,
  `disable_classifier`, `disable_multiplayer`, `disable_shop`, `disable_review`) — all default
  OFF (rollout_percentage: 0), matching each flag's safe-default semantics in code.
- **3 funnels**: Activation, Learning, Multiplayer (see `FUNNELS.md`).
- **1 dashboard**: "Executive / Activation", pinned, with the 3 funnels attached.
- **Live event verification**: confirmed via `execute-sql` against the `events` table.

## Feature flags: declared vs. wired

| Flag | Wired to a real entry point? |
|---|---|
| `disable_camera` | ✅ `hooks/useCamera.ts` |
| `disable_classifier` | ✅ `hooks/useClassifier.ts` |
| `disable_multiplayer` | ✅ `pages/MultiplayerHubPage.tsx` |
| `disable_shop` | ✅ `pages/ShopPage.tsx` |
| `disable_review` | ⚠️ Created in PostHog, typed in code — **not yet wired** to a UI entry point. Review is served by the same `PracticePage` as the alphabet test and mixed quiz, and cleanly isolating just the "review" content type without touching those other two needed more time than this session had. **Future Work.** |
| 6 rollout flags | Created; **no UI reads them yet** — they exist so a future PR gating an actual new-UI rollout can start from `useFeatureFlag('flag_name', false)` on day one instead of adding flag infrastructure then. |

## Dashboards: designed vs. created

`DASHBOARD_GUIDE.md` designs 8 dashboards. **1 of 8 was actually created live** (Executive /
Activation, with 3 funnels attached) — time-boxed given the scope of this session. The other 7
(Learning, Recognition/AI quality, Multiplayer, Errors, Performance, Growth/Retention, Economy)
are fully specified in `DASHBOARD_GUIDE.md` with their exact insights, but **not yet built in
PostHog**. **Future Work** — building them is now a copy-paste-from-the-doc exercise, not a
design exercise.

## Analytics Coverage by feature (Fully Tracked / Partially Tracked / Future Work / N/A)

| Feature | Status | Notes |
|---|---|---|
| Landing page | **Fully Tracked** | `landing_view` (UTM/referrer), CTA clicks, scroll depth, feedback link click |
| Auth (email + Google) | **Fully Tracked** | signup/login/logout/password reset, provider-labeled |
| Onboarding | **Fully Tracked** | Every step, skill selection, dominant hand, completion + duration |
| Camera permission | **Fully Tracked** | Granted/denied/error, per screen |
| Camera framing guide | **Fully Tracked** | Sampled on guidance change, not per-frame |
| AI model load | **Fully Tracked** | Load time, unavailable/kill-switch state |
| Lessons | **Fully Tracked** | Started/completed/skipped, world-scoped |
| Practice (review/alphabet/mixed) | **Partially Tracked** | Session start/complete tracked; `content_type` classification is a heuristic (based on `heading`/`autoStartMixed`), not a first-class prop threaded from the caller — see `PracticePage.tsx`'s `practiceContentType()` |
| Story | **Fully Tracked** | Started/completed, hints, skips, duration |
| Speed Challenge | **Fully Tracked** | Session start/complete with score/combo |
| **Sign recognition (`sign_attempt`)** | **Fully Tracked** | Every rule-pass, across all 6 screens (lesson/practice/story/speed/duel/room), carrying AI confidence/vetoed/latency for aggregate quality metrics |
| AI quality metrics | **Partially Tracked** | Avg confidence/attempts/latency are real PostHog aggregations over `sign_attempt`. **True false-positive/false-negative RATES are NOT measurable from production events** — they need ground-truth labels this data doesn't have. What's tracked is a proxy (`rule_passed ∧ ai_vetoed` = suspected FP). Real FP/FN come from the offline confusor test suite, not prod telemetry — this is stated as a deliberate limitation, not an oversight |
| World/journey completion | **Fully Tracked** | Derived from badge-award logic in `useUserStore.ts` |
| Multiplayer — Duel | **Fully Tracked** | Room lifecycle, match lifecycle, connection lost/reconnected |
| Multiplayer — Room | **Partially Tracked** | Room/match lifecycle tracked; **`multiplayer_connection_lost`/`_reconnected` are NOT wired for Room** — Room's disconnect handling is inline (marks a peer disconnected, match continues) with no dedicated "waiting-reconnect" phase to hook the event on, unlike Duel's explicit reconnect screen. Future Work. |
| Economy (XP/gold/chests/badges/streak) | **Fully Tracked** | Every store mutation function instrumented at its single source, not per call site |
| Friends | **Fully Tracked** | Added/removed |
| Beta feedback | **Fully Tracked** | Submission + bug/feature co-fire |
| Crash monitoring | **Fully Tracked** | Fatal errors, window/promise crashes, unexpected-reload detection |
| General functional errors (`error_captured`) | **Future Work** | Event + payload type declared in `EVENT_REFERENCE.md`/`types.ts`; **not wired at any Supabase/network call site**. Supabase already has its own error-toast pattern (`useProgressSync`'s `syncError`) that this session didn't rewire into analytics — a real gap, not a design decision |
| Performance / Web Vitals | **Fully Tracked** | Automatic via PostHog's `capture_performance` config — no manual events needed |
| Session replay | **N/A by design** | Deliberately disabled — see Architecture doc's privacy posture |
| Heatmaps | **N/A this session** | Not configured; PostHog supports it but it wasn't requested and would need the same privacy review as replay |
| A/B experiments | **N/A this session** | Flags are wired as a substrate; no PostHog Experiment was configured — none of the 6 rollout flags have a UI variant to test yet |
| Groups/orgs | **Future Work** | `beta_cohort` group is live; `organization` is a typed placeholder, unpopulated (no team/classroom accounts exist yet) |

## Recommendations (priority order for a follow-up session)

1. **Wire `error_captured`** at Supabase/network failure points — this is the single biggest
   real gap; production reliability visibility is currently limited to crashes, not degraded-but-
   not-crashed states (a failed Supabase write, a dropped WebRTC connection outside the Duel
   reconnect flow).
2. **Build the remaining 7 dashboards** from `DASHBOARD_GUIDE.md` — they're fully specified, just
   not clicked into existence yet.
3. **Wire Room's connection-lost/reconnected** the same way Duel's is, once Room gets (or is
   confirmed not to need) an explicit reconnect UI state.
4. **Decide on `disable_review`'s actual gate point** — likely the cleanest fix is adding a
   `mode` prop PracticePage already half-has (`content_type`) and gating on it explicitly, rather
   than inferring from `heading`.
5. **Once a rollout flag has a real UI variant to ship**, configure it as a PostHog Experiment
   (not just a flag) to get statistical significance, not just a percentage rollout.
