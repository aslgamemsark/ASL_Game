import type { ActiveEventName, FutureEventName } from './types';

/**
 * The single source of truth for event NAMES. Every string PostHog will ever see for this app
 * lives here, once. Nothing in the codebase should write an event-name string literal directly —
 * import `EVENTS.lesson_completed` (etc.) instead, so a typo or a rename is a compile error
 * everywhere it's used, not a silently-orphaned event in PostHog.
 *
 * Split into ACTIVE (wired to a real call site, actually emitted) and FUTURE (typed, documented,
 * NEVER emitted — see types.ts's FuturePayloads for why each one exists and what unlocks it).
 */

// ACTIVE — keys must exactly match EventPayloads in types.ts (enforced by the `satisfies` below).
export const EVENTS = {
  // Screens
  screen_viewed: 'screen_viewed',

  // Auth
  guest_started: 'guest_started',
  signup_started: 'signup_started',
  signup_completed: 'signup_completed',
  login: 'login',
  logout: 'logout',
  guest_return: 'guest_return',
  password_reset_requested: 'password_reset_requested',
  password_recovery_completed: 'password_recovery_completed',

  // PWA install
  pwa_install_prompted: 'pwa_install_prompted',
  pwa_install_result: 'pwa_install_result',

  // Onboarding
  onboarding_step_viewed: 'onboarding_step_viewed',
  onboarding_skill_selected: 'onboarding_skill_selected',
  onboarding_first_sign_passed: 'onboarding_first_sign_passed',
  first_sign_started: 'first_sign_started',
  dominant_hand_selected: 'dominant_hand_selected',
  onboarding_completed: 'onboarding_completed',
  auth_option_selected: 'auth_option_selected',

  // Camera
  camera_permission_granted: 'camera_permission_granted',
  camera_permission_denied: 'camera_permission_denied',
  camera_error: 'camera_error',
  camera_stalled: 'camera_stalled',
  framing_check: 'framing_check',

  // AI
  ai_model_loaded: 'ai_model_loaded',
  ai_model_unavailable: 'ai_model_unavailable',

  // Lessons / practice / story / speed
  lesson_started: 'lesson_started',
  lesson_completed: 'lesson_completed',
  lesson_skipped: 'lesson_skipped',
  story_started: 'story_started',
  story_completed: 'story_completed',
  speed_session_started: 'speed_session_started',
  speed_session_completed: 'speed_session_completed',
  practice_session_started: 'practice_session_started',
  practice_session_completed: 'practice_session_completed',
  hint_used: 'hint_used',
  sign_attempt: 'sign_attempt',
  first_sign_success: 'first_sign_success',

  // Business completion
  world_completed: 'world_completed',
  journey_completed: 'journey_completed',

  // Multiplayer
  multiplayer_room_created: 'multiplayer_room_created',
  multiplayer_room_joined: 'multiplayer_room_joined',
  multiplayer_room_left: 'multiplayer_room_left',
  multiplayer_match_started: 'multiplayer_match_started',
  multiplayer_match_finished: 'multiplayer_match_finished',
  multiplayer_match_abandoned: 'multiplayer_match_abandoned',
  multiplayer_connection_lost: 'multiplayer_connection_lost',
  multiplayer_reconnected: 'multiplayer_reconnected',
  multiplayer_ice_connected: 'multiplayer_ice_connected',
  multiplayer_ice_failed: 'multiplayer_ice_failed',

  // Economy
  level_up: 'level_up',
  item_purchased: 'item_purchased',
  chest_opened: 'chest_opened',
  chest_skipped: 'chest_skipped',
  achievement_unlocked: 'achievement_unlocked',
  streak_extended: 'streak_extended',
  streak_lost: 'streak_lost',

  // Engagement
  friend_added: 'friend_added',
  friend_removed: 'friend_removed',

  // Feedback
  feedback_submitted: 'feedback_submitted',
  bug_reported: 'bug_reported',
  feature_requested: 'feature_requested',

  // Crash / errors
  fatal_error: 'fatal_error',
  session_crashed: 'session_crashed',
  unexpected_reload: 'unexpected_reload',
  error_captured: 'error_captured',

  // Static marketing pages — see EventPayloads' comment on these in types.ts.
  landing_view: 'landing_view',
  alphabet_landing_view: 'alphabet_landing_view',
  hero_cta_clicked: 'hero_cta_clicked',
  feedback_clicked: 'feedback_clicked',
  scroll_depth: 'scroll_depth',
} satisfies Record<ActiveEventName, string>;

// FUTURE — documented placeholders only. Never passed to track(); listed here purely so the
// taxonomy (and EVENT_REFERENCE.md, generated from this file) shows what's planned vs. shipped.
export const FUTURE_EVENTS = {
  mobile_app_opened: 'mobile_app_opened',
  second_language_lesson_started: 'second_language_lesson_started',
  organization_created: 'organization_created',
  subscription_started: 'subscription_started',
  subscription_cancelled: 'subscription_cancelled',
} satisfies Record<FutureEventName, string>;
