# Funnels

Built in PostHog (Product Analytics → Funnels) using `EVENT_REFERENCE.md`'s events. Created via
the PostHog MCP connector — see the session's final report for live links; recreate here manually
if a link goes stale.

## Activation funnel

Rebuilt 2026-08-31 (launch-readiness Phase A/C) around the real URL architecture (`/` = marketing,
`/app` = product) and the value-before-signup order (a real sign attempt happens INSIDE onboarding,
before `onboarding_completed`, not after it):

`landing_view` (`/`) → `hero_cta_clicked` → `screen_viewed` (screen=onboarding, first app open) →
`first_sign_started` → `sign_attempt` (source=onboarding, final_passed=true) / `first_sign_success`
(the product's real activation event — fires once per browser, from whichever surface produces it
first) → `onboarding_completed` → `lesson_started` (first real lesson) → `lesson_completed` (first)
→ return `screen_viewed` on a later calendar day (Day-2 retention).

Every event from `hero_cta_clicked` onward carries first-touch/session-touch UTM properties (see
EVENT_REFERENCE.md's Attribution section) as PostHog super properties — breaking this funnel down
by `first_touch_utm_source`/`_medium`/`_campaign` answers "which channel actually produces activated
users," not just "which channel produces clicks."

Breakdown by `skill_level` (from `onboarding_skill_selected`, which now fires before the first-sign
step) shows whether beginners drop off faster than intermediate/advanced users.

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
