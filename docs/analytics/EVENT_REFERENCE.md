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

## Onboarding
| Event | Key properties |
|---|---|
| `onboarding_step_viewed` | `step` (welcome/auth/skill/hand/done) |
| `onboarding_skill_selected` | `skill_level` |
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
| **`sign_attempt`** | The canonical recognition event — fires on every rule-pass (whether or not the AI vetoes it). `sign_id`, `world_id`, `source` (lesson/practice/story/speed/duel/room), `rule_passed`, `ai_vetoed`, `final_passed`, `ai_prediction`, `ai_confidence`, `duration_ms`, `attempt_number`. **Aggregate AI-quality metrics (avg confidence, avg attempts-to-success, avg latency) are PostHog aggregations over this one event, not separate events.** |

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

## Future (planned, not emitted)
`mobile_app_opened`, `second_language_lesson_started`, `organization_created`,
`subscription_started`, `subscription_cancelled` — see `types.ts`'s `FuturePayloads`.
