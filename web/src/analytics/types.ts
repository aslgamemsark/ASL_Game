/**
 * Typed payload for every event this app is allowed to emit. `track()` in capture.ts is generic
 * over this map, so passing the wrong shape for an event — or a made-up event name — is a
 * compile error, not a silent PostHog ingestion mismatch discovered weeks later.
 *
 * Keep payloads flat and free of PII: no email, no password, no raw hand landmarks, no full
 * error stacks. Anything identity-related belongs in `identifyUser()` (capture.ts), not here.
 */

// ---- Shared fragments reused across several event payloads -----------------------------------

/** Which top-level app screen the user was on (App.tsx's `Screen['type']`), for events that fire
 *  from a specific screen but aren't a screen-view themselves. */
export type ScreenName =
  | 'home' | 'onboarding' | 'lesson' | 'practice' | 'story' | 'speed' | 'shop' | 'friends'
  | 'multiplayer' | 'settings' | 'leaderboard' | 'admin' | 'privacy' | 'user-profile';

/** Every mode that can produce a sign attempt. Distinct from ScreenName: Duel and Room are two
 *  modes of the single 'multiplayer' screen, and attempt analytics needs to tell them apart. */
export type AttemptSource = 'lesson' | 'practice' | 'story' | 'speed' | 'duel' | 'room';

/** A sign-recognition attempt's outcome, shared by every screen that runs the recognition loop
 *  (Lesson/Practice/Story/Speed/Duel/Room) — see engine/gate.ts for what rule-pass/veto mean. */
export interface SignAttemptBase {
  sign_id: string;
  world_id: string | null;
  /** Which screen/mode produced this attempt. */
  source: AttemptSource;
  rule_passed: boolean;
  /** True only when the ML classifier rejected a rule-pass (see engine/gate.ts) — the classifier
   *  can never turn a rule-fail into a pass, so this is only ever meaningful when rule_passed. */
  ai_vetoed: boolean;
  final_passed: boolean;
  ai_prediction: string | null;
  ai_confidence: number | null;
  /** Wall-clock ms from recognition loop start to this attempt's outcome. */
  duration_ms: number;
  /** How many attempts (including this one) the user has made at this sign in the current session. */
  attempt_number: number;
}

export interface MultiplayerBase {
  mode: 'duel' | 'room';
  room_id: string;
}

// ---- ACTIVE event payloads (emitted today, for features that exist) ---------------------------

export interface EventPayloads {
  // Screens
  screen_viewed: { screen: ScreenName; previous_screen: ScreenName | null };

  // Auth (see contexts/AuthContext.tsx)
  guest_started: Record<string, never>;
  signup_started: { provider: 'email' | 'google' };
  signup_completed: { provider: 'email' | 'google' };
  login: { provider: 'email' | 'google' };
  logout: Record<string, never>;
  password_reset_requested: Record<string, never>;
  password_recovery_completed: Record<string, never>;

  // Onboarding (components/onboarding/OnboardingFlow.tsx)
  onboarding_step_viewed: { step: 'welcome' | 'auth' | 'skill' | 'done' };
  onboarding_skill_selected: { skill_level: 'beginner' | 'intermediate' | 'advanced' };
  onboarding_completed: { skill_level: string; duration_ms: number };

  // Dominant-hand check (components/shared/DominantHandCheck.tsx) — moved out of onboarding
  // (2026-07-23) to the first real camera session (see PracticePage), not asked before a
  // brand-new user has even seen the app.
  dominant_hand_selected: { hand: 'left' | 'right'; skipped: boolean };

  // Camera (hooks/useCamera.ts)
  camera_permission_granted: { screen: ScreenName };
  camera_permission_denied: { screen: ScreenName };
  camera_error: { screen: ScreenName; error_name: string };

  // Camera framing guide (engine/framing.ts) — sampled, not per-frame.
  framing_check: { ok: boolean; reason: string | null; screen: ScreenName };

  // AI / recognition model (hooks/useClassifier.ts)
  ai_model_loaded: { load_ms: number };
  ai_model_unavailable: Record<string, never>;

  // Lessons / practice / story / speed session lifecycle
  lesson_started: { lesson_id: string; world_id: string | null };
  lesson_completed: { lesson_id: string; world_id: string | null; duration_ms: number; hints_used: number; xp_earned: number };
  lesson_skipped: { lesson_id: string; world_id: string | null; cost: number };
  story_started: { story_id: string; world_id: string | null };
  story_completed: { story_id: string; world_id: string | null; duration_ms: number; hints_used: number; skips_used: number };
  speed_session_started: { tier: string };
  speed_session_completed: { tier: string; score: number; combo: number; signs_earned: number };
  practice_session_started: { content_type: 'review' | 'alphabet' | 'mixed'; question_count: number };
  practice_session_completed: { content_type: 'review' | 'alphabet' | 'mixed'; correct: number; total: number; xp_earned: number };
  hint_used: { screen: ScreenName; sign_id: string; hint_level: number };

  // The single canonical sign-attempt event — pass/fail is the `final_passed` property, not a
  // separate event name, so aggregate AI-quality metrics (avg confidence, avg attempts-to-success,
  // avg latency) are one PostHog query over one event instead of stitched across two.
  sign_attempt: SignAttemptBase;

  // Business-level completion (derived from useUserStore.completedLessons vs data/worlds.ts)
  world_completed: { world_id: string; badge_id: string };
  journey_completed: { total_worlds: number };

  // Multiplayer (hooks/useMultiplayerSignaling.ts, pages/DuelPage.tsx, pages/RoomPage.tsx) — one
  // event family for both Duel (2p) and Room (up to 4p), disambiguated by `mode`.
  multiplayer_room_created: MultiplayerBase & { visibility: 'public' | 'private'; rounds: number; turn_seconds: number };
  multiplayer_room_joined: MultiplayerBase & { via: 'code' | 'search' | 'challenge' };
  multiplayer_room_left: MultiplayerBase;
  multiplayer_match_started: MultiplayerBase & { player_count: number };
  multiplayer_match_finished: MultiplayerBase & { player_count: number; duration_ms: number; won: boolean; forfeited: boolean };
  multiplayer_match_abandoned: MultiplayerBase & { at_round: number };
  multiplayer_connection_lost: MultiplayerBase;
  multiplayer_reconnected: MultiplayerBase & { downtime_ms: number };

  // Economy (stores/useUserStore.ts)
  level_up: { new_level: number };
  item_purchased: { item_id: string; gold_price: number; item_type: 'cosmetic' | 'rename_card' | 'streak_freeze' | 'world_unlock' };
  chest_opened: { chest_id: string; signs_won: number; gold_won: number };
  chest_skipped: { chest_id: string; gold_cost: number };
  achievement_unlocked: { badge_id: string; gold_reward: number };
  streak_extended: { new_streak: number; used_freeze: boolean };
  streak_lost: { previous_streak: number };

  // Engagement
  friend_added: Record<string, never>;
  friend_removed: Record<string, never>;

  // Beta feedback (components/shared/FeedbackModal.tsx). `feedback_submitted` always fires;
  // `bug_reported`/`feature_requested` ALSO fire when the category matches — deliberate, not
  // event-name duplication (each is a distinct name), so a bug-report funnel doesn't require
  // filtering feedback_submitted by property.
  feedback_submitted: { category: 'bug' | 'feature' | 'other'; page: string; anonymous: boolean };
  bug_reported: { page: string };
  feature_requested: { page: string };

  // Crash monitoring (lib/errorReporting.ts, components/shared/ErrorBoundary.tsx)
  fatal_error: { message: string; component_stack_present: boolean; route: string };
  session_crashed: { source: 'window-error' | 'unhandled-rejection'; message: string };
  unexpected_reload: { seconds_since_last_error: number };

  // General functional errors (Supabase/network) that aren't a crash but matter for reliability.
  error_captured: { source: 'supabase' | 'network' | 'multiplayer' | 'other'; message: string; route: string };
}

export type ActiveEventName = keyof EventPayloads;

// ---- FUTURE events (documented, typed, NOT emitted) --------------------------------------------
//
// Placeholders for features named in the project roadmap (CLAUDE.md) but not yet built. Adding a
// real emission for one of these means: (1) move its entry from FuturePayloads to EventPayloads,
// (2) add it to events.ts's ACTIVE section, (3) wire it at the real call site. Never emit these
// today — there is nothing behind them yet.
export interface FuturePayloads {
  /** Mobile app (cousin's firm build-out) install/open. */
  mobile_app_opened: { platform: 'ios' | 'android' };
  /** A second sign language (DGS) lesson, once that content exists. */
  second_language_lesson_started: { language: string; lesson_id: string };
  /** Classroom/team account creation, once organization accounts exist. */
  organization_created: { org_id: string };
  /** A paid plan, once monetization ships. */
  subscription_started: { plan: string };
  subscription_cancelled: { plan: string; reason: string | null };
}

export type FutureEventName = keyof FuturePayloads;
