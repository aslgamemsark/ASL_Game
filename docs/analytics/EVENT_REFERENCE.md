# Event Reference

Source of truth is code: `web/src/analytics/events.ts` (names) and `types.ts` (payloads). This
doc is a human-readable mirror — if it drifts from the code, the code wins.

## Screens
| Event | Fires when | Key properties |
|---|---|---|
| `screen_viewed` | Every top-level navigation (`App.tsx`'s `screen` union changes) | `screen`, `previous_screen` |

## Auth
| Event | Fires when |
|---|---|
| `guest_started` | User taps "Continue as guest" in onboarding |
| `signup_started` | Email signup submitted, or Google OAuth initiated |
| `signup_completed` | Email signup succeeds; or a Google OAuth user's profile is first created (no prior row) |
| `login` | `SIGNED_IN` auth event (any provider, any real sign-in) |
| `logout` | Explicit sign-out |
| `password_reset_requested` | Reset email requested |
| `password_recovery_completed` | New password set after following the reset link |

## PWA install
| Event | Fires when | Key properties |
|---|---|---|
| `pwa_install_prompted` | User taps the install button (banner or Settings row) | `source` |
| `pwa_install_result` | Native install prompt resolves | `source`, `outcome` |

## Onboarding
| Event | Key properties |
|---|---|
| `onboarding_step_viewed` | `step` (welcome/auth/skill/firstSign/done) |
| `onboarding_skill_selected` | `skill_level` |
| `auth_option_selected` | `method` (google/email/guest) — which door the user took at the auth step |
| `first_sign_started` | `sign_id` — the first-sign recognition loop actually starts sampling frames, not merely that the step rendered (distinct from `onboarding_step_viewed`; a slow camera-permission grant can open a real gap between the two) |
| `onboarding_first_sign_passed` | `sign_id` — onboarding-specific pass marker for the first-sign step. Also feeds the canonical `sign_attempt`/`first_sign_success` events below via `source: 'onboarding'` |
| `dominant_hand_selected` | `hand`, `skipped` |
| `onboarding_completed` | `skill_level`, `duration_ms` |

## Camera & AI
| Event | Key properties |
|---|---|
| `camera_permission_granted` / `_denied` | `screen` |
| `camera_error` | `screen`, `error_name` |
| `framing_check` | `ok`, `reason`, `screen` — sampled (fires only when guidance text changes, not per frame) |
| `ai_model_loaded` | `load_ms` |
| `ai_model_unavailable` | (no model deployed, or `disable_classifier` kill switch on) |

## Lessons / Practice / Story / Speed
| Event | Key properties |
|---|---|
| `lesson_started` / `lesson_completed` / `lesson_skipped` | `lesson_id`, `world_id`, plus `duration_ms`/`hints_used`/`xp_earned` (completed) or `cost` (skipped) |
| `story_started` / `story_completed` | `story_id`, `world_id`, `duration_ms`, `hints_used`, `skips_used` |
| `speed_session_started` / `_completed` | `tier`, plus `score`/`combo`/`signs_earned` (completed) |
| `practice_session_started` / `_completed` | `content_type` (review/alphabet/mixed), `question_count`, plus `correct`/`total`/`xp_earned` (completed) |
| `hint_used` | `screen`, `sign_id`, `hint_level` |
| **`sign_attempt`** | The canonical recognition event — fires on every rule-pass (whether or not the AI vetoes it). `sign_id`, `world_id`, `source` (lesson/practice/story/speed/duel/room/**onboarding**), `rule_passed`, `ai_vetoed`, `final_passed`, `ai_prediction`, `ai_confidence`, `duration_ms`, `attempt_number`. **Aggregate AI-quality metrics (avg confidence, avg attempts-to-success, avg latency) are PostHog aggregations over this one event, not separate events.** `source: 'onboarding'` added 2026-08-31 — the first-sign step runs the same recognition loop as every other signing screen and now feeds this event too. |
| **`first_sign_success`** | The product's real activation event — the moment a user (guest or signed-in) first passes ANY sign, ever. Fires once per browser (localStorage-guarded), from every surface that can produce a pass, including onboarding's first-sign step since 2026-08-31. `sign_id`, `ms_since_lesson_start`, `attempts_taken`. |

## Business completion
| Event | Fires when |
|---|---|
| `world_completed` | The completion badge for a `data/worlds.ts` world is newly awarded |
| `journey_completed` | All worlds' completion badges are held |

## Multiplayer
One event family for both Duel (2p) and Room (up to 4p), disambiguated by `mode`.
| Event | Key properties |
|---|---|
| `multiplayer_room_created` | `mode`, `room_id`, `visibility`, `rounds`, `turn_seconds` |
| `multiplayer_room_joined` | `mode`, `room_id`, `via` (code/search/challenge) |
| `multiplayer_room_left` | Left from a non-active phase (lobby/waiting) |
| `multiplayer_match_started` | `mode`, `room_id`, `player_count` |
| `multiplayer_match_finished` | `mode`, `room_id`, `player_count`, `duration_ms`, `won`, `forfeited` |
| `multiplayer_match_abandoned` | Left mid-match (signer/guesser/result phase) — `at_round` |
| `multiplayer_connection_lost` / `_reconnected` | Duel only today (see Coverage Report) — `downtime_ms` on reconnect |

## Economy
| Event | Key properties |
|---|---|
| `level_up` | `new_level` |
| `item_purchased` | `item_id`, `gold_price`, `item_type` (cosmetic/rename_card/streak_freeze/world_unlock) |
| `chest_opened` / `chest_skipped` | `chest_id`, plus `signs_won`/`gold_won` or `gold_cost` |
| `achievement_unlocked` | `badge_id`, `gold_reward` |
| `streak_extended` | `new_streak`, `used_freeze` |
| `streak_lost` | `previous_streak` |

## Engagement
`friend_added`, `friend_removed` — no properties (identity carries the rest).

**`share_clicked`** (`components/shared/ShareButton.tsx`, added 2026-08-31) — the share loop's
smallest useful version (launch-readiness Phase G). One event covers both outcomes: `method`
(`share_sheet` on mobile via the Web Share API, `clipboard` as the desktop fallback), `context`
(where the button appeared — today only `first_lesson_complete`, LessonPage's first-ever-lesson
celebration screen). Does not fire on a share-sheet cancel. The shared link points at `/` with
`utm_source=share&utm_medium=referral&utm_campaign=first_lesson_share`, so a referred visitor's
first-touch attribution correctly credits the sharer's channel, not "direct."

## Feedback (beta)
| Event | Fires when |
|---|---|
| `feedback_submitted` | Every feedback submission — `category`, `page`, `anonymous` |
| `bug_reported` | Also fires when `category === 'bug'` |
| `feature_requested` | Also fires when `category === 'feature'` |

## Crash / errors
| Event | Fires when |
|---|---|
| `fatal_error` | `ErrorBoundary` catches a render error |
| `session_crashed` | Unhandled window error or promise rejection |
| `unexpected_reload` | The tab reloads shortly after a logged error (via a sessionStorage sentinel) |
| `error_captured` | Reserved for Supabase/network/multiplayer functional errors — see Coverage Report |

## Performance
No manual events — Web Vitals (LCP/CLS/INP/FCP/TTFB) are captured automatically via PostHog's
`capture_performance: { web_vitals: true }` config.

## Feature flags
See `web/src/analytics/featureFlags.ts`. Rollout: `framing_gate`, `hand_skeleton`,
`new_multiplayer_ui`, `new_onboarding`, `new_shop`, `mascot_variant`. Kill switches:
`disable_camera`, `disable_classifier`, `disable_multiplayer`, `disable_shop`, `disable_review`
(declared; UI-wired for camera/classifier/multiplayer/shop — see Coverage Report for `disable_review`).

## Marketing (static pages) & attribution

Fired from `web/public/home.html` and `web/public/asl-alphabet.html` via a raw, hand-authored
PostHog call — those pages predate the app bundle and have no build step to import `track()`. Typed
in `types.ts` anyway for schema documentation; keep this table and that file in sync by hand.

| Event | Fires when | Key properties |
|---|---|---|
| `landing_view` | Every load of `/` | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer` |
| `alphabet_landing_view` | Every load of `/asl-alphabet.html` | `referrer` |
| `hero_cta_clicked` | Any `.btn-primary` click on either page | `label`, `href`, `page` (landing/asl-alphabet), `cta_location` (nav/hero/final/footer/other — from the link's own `data-cta-location` attribute), `destination` |
| `feedback_clicked` | The Google Form feedback link is clicked (home.html only) | — |
| `scroll_depth` | 25/50/75/100% scroll thresholds, once each per load | `depth` |

**First-touch / session-touch attribution** (`web/src/analytics/attribution.ts`, mirrored inline in
both static pages with identical storage keys/shape): any UTM-bearing page load writes to
`localStorage['qs_first_touch']` (write-once — the channel that ORIGINALLY brought this browser
here) and `sessionStorage['qs_session_touch']` (overwritten per UTM-bearing load — the channel that
drove THIS visit). Same-origin storage is what carries this from a marketing page into `/app` with
no URL plumbing. `client.ts` registers both, flattened and prefixed (`first_touch_utm_source`,
`session_utm_source`, etc.), as PostHog super properties, so **every** event from every screen
carries them — not just the marketing events above. `capture.ts`'s `identifyUser` additionally
`$set_once`s the first-touch properties onto the Person profile, so the original channel survives a
later `identify()` (a different device, a re-login) that would otherwise overwrite it.

## Future (planned, not emitted)
`mobile_app_opened`, `second_language_lesson_started`, `organization_created`,
`subscription_started`, `subscription_cancelled` — see `types.ts`'s `FuturePayloads`.
