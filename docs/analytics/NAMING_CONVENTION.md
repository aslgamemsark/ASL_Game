# Naming Convention

- **Events:** `snake_case`, `object_action` order — `lesson_completed`, `sign_attempt`,
  `multiplayer_room_created`. Past tense for things that happened (`_completed`, `_started`,
  `_lost`), not commands.
- **One event per real occurrence, not per outcome.** `sign_attempt` is a single event with a
  `final_passed: boolean` property, not `sign_attempt_passed` / `sign_attempt_failed` as two
  separate names — this keeps aggregate queries (avg confidence, avg latency) a single-event
  query instead of a UNION, and avoids the event-name count growing every time a new True/False
  outcome axis gets added to an existing flow. The exception: `feedback_submitted` +
  `bug_reported`/`feature_requested` deliberately co-fire (see EVENT_REFERENCE.md) because bug
  reports and feature requests are genuinely different analysis subjects worth their own funnel,
  not just a property filter.
- **Properties:** `snake_case`. Booleans read as a yes/no question in the affirmative:
  `rule_passed`, `ai_vetoed`, `won`, `forfeited` — never `is_rule_passed` or `not_forfeited`.
- **IDs:** always `_id` suffix — `sign_id`, `world_id`, `room_id`, `badge_id`, `item_id`.
- **Durations:** always `_ms` suffix, always milliseconds — never mix units across properties.
- **No PII in any name or value.** No email, username-as-identifier (use the PostHog distinct id
  via `identifyUser`, never put a username in an event property), no raw landmarks.
- **Screen names** (`ScreenName` in `types.ts`) match `App.tsx`'s `Screen['type']` union exactly
  — one source of truth, checked by TypeScript, not duplicated as a separate string enum.
- **Feature flags:** `snake_case`, verb-first for kill switches (`disable_camera`), noun/adjective
  for rollout flags (`new_onboarding`, `mascot_variant`).
