# Funnels

Built in PostHog (Product Analytics → Funnels) using `EVENT_REFERENCE.md`'s events. Created via
the PostHog MCP connector — see the session's final report for live links; recreate here manually
if a link goes stale.

## Activation funnel
`landing_view` (landing.html) → `hero_cta_clicked` → `screen_viewed` (screen=home, first app open)
→ `onboarding_completed` → `lesson_started` (first) → `sign_attempt` (final_passed=true, first) →
`lesson_completed` (first) → return `screen_viewed` on a later calendar day (Day-2 retention).

Breakdown by `skill_level` (from `onboarding_completed`) shows whether beginners drop off faster
than intermediate/advanced users.

## Learning funnel
`lesson_started` → `sign_attempt` → `lesson_completed` (vs. `lesson_skipped`). Segment by
`world_id` to see which world (coffee/hospital/classroom/greetings) has the worst completion
rate — a real signal for where recognition or content needs work.

## Multiplayer funnel
`screen_viewed` (screen=multiplayer) → `multiplayer_room_created` OR `multiplayer_room_joined` →
`multiplayer_match_started` → `multiplayer_match_finished` (vs. `multiplayer_match_abandoned`).
Segment by `mode` (duel vs. room) — they're genuinely different products with different
completion dynamics.

## Recognition trust funnel (custom, worth building post-launch)
`sign_attempt` (rule_passed=true) → filtered to `ai_vetoed=true` — the volume of this segment is
literally "how often would a user have falsely passed without the AI gate." A rising trend here
means the rule thresholds for a specific sign need recalibration, not the model.
