# Analytics event reference

_Reviewed against the working-tree contract on 2026-09-19. This documents implemented call sites,
not proof of deployment or live delivery. Names/payloads in `web/src/analytics/events.ts` and
`types.ts` are authoritative. Use [Funnels](FUNNELS.md) for filters and denominators._

## Meaning that must not be lost

- **`sign_attempt` means a rule-pass gate decision**, including a possible classifier veto. It
  does not count all physical tries, rule failures, skips or no-hand frames. Its pass rate is not
  recognition accuracy. `attempt_number` / `attempts_taken` count decisions for the prompted sign.
- **`recognition_run_*` means a recognition-loop lifecycle.** One run can contain many physical
  tries. End outcomes are accepted, skipped, interrupted, sign_changed or unmounted. Abrupt tab
  loss can omit an end. Keep unmatched starts visible.
- **`first_sign_success` v3 is device-local per guest/account.** A guest success migrates to the
  signing-in account; subsequent account switches do not inherit another account's activation.
  It is not globally deduplicated across browsers/devices. Storage is marked only after SDK
  acceptance, which is not a server receipt. Opt-out, blocked storage and delivery failures affect it.
- Activation can precede auth, onboarding completion and any lesson. Unversioned success events
  excluded onboarding; v2 was browser-wide; do not merge those semantics into a v3 funnel.
- The optional ML classifier is disabled. MediaPipe readiness is measured separately. No event
  here supplies qualified ground-truth ASL labels or proves a demonstration teaches correctly.

## Screens, auth and onboarding

| Event | Actual meaning / useful properties |
|---|---|
| `screen_viewed` | SPA navigation; `screen`, `previous_screen` |
| `guest_started` | Guest choice at the onboarding auth step; not first visit |
| `guest_return` | Return on another local calendar date for this browser; `gap_days` since last visit, not first-use retention |
| `signup_started` | Validated email-signup action before the request; `provider=email` |
| `signup_submitted` | Email signup request returned a user; confirmation may still be required, and this does not establish a unique new account |
| `auth_started` | Google OAuth intent before redirect; may be an existing account |
| `login` | Observed `SIGNED_IN`, deduplicated per active user in the mounted auth provider; not a return-session counter |
| `logout` | Explicit logout action; identity reset is also handled from auth state |
| `password_reset_requested`, `password_recovery_completed` | Reset request action / successful password update, not email-delivery proof |
| `auth_option_selected` | Onboarding choice: `method=google/email/guest` |
| `onboarding_step_viewed` | `step=welcome/skill/firstSign/auth/done`; some paths skip steps |
| `onboarding_skill_selected` | Selected `skill_level` |
| `onboarding_first_sign_passed` | The onboarding sign cleared the verifier; local UI guard limits duplicates |
| `onboarding_completed` | Flow finished; `skill_level`, `duration_ms`; camera/signing may have been skipped |
| `dominant_hand_selected` | Hand-check choice; `hand`, `skipped`; not a mandatory onboarding step |
| `first_sign_success` | `sign_id`, `source`, `flow_version=3`, `identity_scope=guest/account`, `ms_since_lesson_start`, `attempts_taken` |

The legacy property `ms_since_lesson_start` measures from the reporting screen's mount, including
onboarding. It is not time since app entry, pure inference latency or all time spent on a sign.
Removed signup/crash labels remain in historical data; their old meanings are not repaired retroactively.

## Camera, recognition and reference clips

| Event | Actual meaning / useful properties |
|---|---|
| `camera_requested` | Camera start request; `screen`, `camera_request_id` |
| `camera_first_frame` | First playback-ready frame for that request; same id plus `duration_ms` |
| `camera_permission_granted`, `camera_permission_denied` | getUserMedia outcome by `screen`; grant does not establish a usable feed |
| `camera_error` | Camera/playback error by `screen`, `error_name`; not necessarily a permission denial |
| `camera_stalled` | `reason=no_frame/track_ended` by screen |
| `framing_check` | Sampled framing guidance; `ok`, `reason`, `screen`, not a per-frame event |
| `recognition_model_initialized` | MediaPipe init outcome `ready/error`, `screen`, `duration_ms`; not optional ML readiness |
| `recognition_run_started` | `run_id`, `sign_id`, `screen` |
| `recognition_run_ended` | Same ids plus `outcome`, `duration_ms`, `processed_frames`, `last_failing_parameter`; last failure is diagnostic, not a linguistic verdict |
| `sign_attempt` | `sign_id`, `world_id`, `source`, `rule_passed`, `ai_vetoed`, `final_passed`, `ai_prediction`, `ai_confidence`, `duration_ms`, `attempt_number`; rule-pass decisions only |
| `reference_clip_played` | First observed playback per rendered clip/sign; `sign_id`; not proof it was watched or accurate |
| `reference_clip_error` | Missing clip or media load error; `sign_id`, `reason=missing/load_error` |
| `ai_model_loaded`, `ai_model_unavailable` | Optional classifier branch diagnostics; `load_ms` on success. Disabled classifier loading makes these unsuitable as current core-camera health alerts |

Attempt sources: onboarding, lesson, practice, story, speed, duel and room. Shared reporting
includes guests under consent. Supabase attempt persistence is separate: onboarding/duel/room
are analytics-only; other sources require an account. `recordMiss` does not emit `sign_attempt`.

## Learning, completion and rewards

| Event | Useful properties / boundary |
|---|---|
| `lesson_started` | `lesson_id`, `world_id` |
| `lesson_completed` | Same ids plus `duration_ms`, `hints_used`, `xp_earned`, `correct`, `total`, `skipped`; completion is not mastery |
| `lesson_skipped` | Separate cost-bearing lesson skip; `lesson_id`, `world_id`, `cost`; not each prompt skip |
| `story_started`, `story_completed` | `story_id`, `world_id`; completion adds duration, hints and skips |
| `practice_session_started`, `practice_session_completed` | `content_type`; start adds question count, completion adds correct/total/XP |
| `speed_session_started`, `speed_session_completed` | `tier`; completion adds score, combo and signs earned |
| `hint_used` | `screen`, `sign_id`, `hint_level` |
| `world_completed`, `journey_completed` | Derived completion badges; world/badge ids or total worlds |
| `level_up` | `new_level` |
| `item_purchased` | `item_id`, `gold_price`, `item_type`; virtual gold, not cash revenue |
| `chest_opened`, `chest_skipped` | Chest id plus signs/gold reward or skip cost |
| `achievement_unlocked` | `badge_id`, `gold_reward` |
| `streak_extended`, `streak_lost` | New streak/freeze use or previous streak |
| `friend_added`, `friend_removed` | Friend action, no target identity in payload |

## Multiplayer

Shared events use `mode=duel/room` and `room_id`. Correlate room sessions; don't add raw lifecycle
counts together and call them unique matches.

| Events | Useful properties |
|---|---|
| `multiplayer_room_created` | Visibility, rounds, turn seconds |
| `multiplayer_room_joined` | `via=code/search/challenge` |
| `multiplayer_room_left` | Lobby/non-active departure |
| `multiplayer_match_started` | Player count |
| `multiplayer_match_finished` | Player count, duration, won, forfeited |
| `multiplayer_match_abandoned` | `at_round` |
| `multiplayer_connection_lost`, `multiplayer_reconnected` | Reconnection diagnostics; downtime on reconnect; check mode coverage before comparing |
| `multiplayer_ice_connected` | Connection time, candidate type, relay use, default-TURN use |
| `multiplayer_ice_failed` | Failure reason, default-TURN use |

## Feedback, errors and install

| Events | Meaning |
|---|---|
| `feedback_submitted` | Feedback category, page and anonymous flag; no message body |
| `bug_reported`, `feature_requested` | Co-fire for those feedback categories; not additional submissions |
| `fatal_error` | React error boundary failure; message, route, component-stack presence and error class |
| `client_error` | Window error/unhandled rejection; source, sanitized message and error class. A handled/recovered app may continue; not a crash counter |
| `unexpected_reload` | Reload soon after a recorded error; timing correlation, not proof of cause |
| `error_captured` | Instrumented functional failure; source, sanitized message and route; not every failed network call |
| `pwa_install_prompted`, `pwa_install_result` | Install action source and accepted/dismissed prompt outcome |

## Static marketing pages and automatic diagnostics

| Events | Meaning |
|---|---|
| `landing_view`, `alphabet_landing_view` | Their respective page loads; sanitized referrer/campaign context |
| `hero_cta_clicked` | `label`, `href`, `page`; intent to navigate, not proof the destination loaded |
| `feedback_clicked` | Marketing feedback link click |
| `scroll_depth` | Threshold 25/50/75/100; scrolling is not lesson engagement |

SDK pageleave, Web Vitals, replay and autocapture are not manually declared product events.
See [Architecture](ARCHITECTURE.md) for their privacy settings and [Developer Guide](DEVELOPER_GUIDE.md)
for adding a real event. Planned features have no placeholder event registry.
