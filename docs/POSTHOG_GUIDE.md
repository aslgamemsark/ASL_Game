# QuickSign — using PostHog without misleading yourself

Project **518794** on PostHog US. Open the existing [Growth / Launch dashboard](https://us.posthog.com/project/518794/dashboard/2067585)
first; [the dashboard map](analytics/DASHBOARD_GUIDE.md) links the other existing views.
This guide describes the current code contract, not proof that new events have been deployed.

## The three questions that matter

1. **Do visitors reach a first accepted sign?** Activation is `first_sign_success` with
   `flow_version=3`. It can happen during onboarding, before login or a lesson. Don't require
   onboarding completion or a full lesson before counting that first value.
2. **Can they keep learning?** Inspect camera request → first frame, MediaPipe initialization,
   recognition-run outcomes and lesson completion with correct/skipped counts. Completing a
   lesson after skips does not establish that the learner mastered its signs.
3. **Do they return?** Use a separate retention insight from first success to later learning.
   Define “Day 2” as the next calendar day after first use (day-offset 1), choose a timezone and
   include only cohorts old enough to finish that window.

## Use the right population

For clean external production results, require canonical hostname `quicksignn.vercel.app`,
`deployment_environment=production` and `traffic_type=external`. Show missing/unknown historical
traffic separately. “Not internal” is too broad. Mark test browsers with `?internal=1`; clear with
`?internal=0`. Country is not a reliable test-user filter.

Use `git_commit` and event versions to separate releases. New probes have no historical baseline
before deployment. Small samples are directional; show the number of people and the denominator
beside each percentage. Missing events can reflect consent, blockers or closed tabs.

## What the numbers actually mean

| Signal | Useful for | Does not prove |
|---|---|---|
| `first_sign_success` v3 | First accepted sign for a guest/account in this browser | One lifetime activation per human across all devices |
| `recognition_run_ended` | Accepted/skipped/interrupted/sign_changed/unmounted loop outcomes | Number of physical tries or ASL accuracy |
| `sign_attempt` | Rule-pass decisions reaching the optional gate | All failures; its pass percentage is not overall recognition accuracy |
| `reference_clip_error` / `reference_clip_played` | Missing/broken clips and playback | Correct or high-quality ASL instruction |
| `signup_submitted` | Email request progressed | A confirmed unique new account |
| `auth_started` | Google sign-in intent | A completed signup |
| `client_error` | Browser JavaScript error/rejection | An app crash |
| `lesson_completed` | Completed lesson flow with result counts | Mastery or learning improvement |

The optional ML classifier is disabled. A missing `ai_model_loaded` event is not a camera outage.
Use `recognition_model_initialized` for MediaPipe readiness. Even when AI votes exist, a veto is
not proof the learner was wrong; reliable accuracy needs qualified ground-truth review.

Anonymous history is linked through identification on sign-in. Account switches/logout reset
identity appropriately. Guest/account first-success deduplication remains local to browser storage;
it does not make anonymous people globally identifiable.

## A short weekly review

- Review activation and next-day learning retention, with cohort size and release filters visible.
- Find camera startup failures, unmatched recognition starts, skipped/interrupted runs and broken
  reference clips. Inspect relevant replay or error details before choosing a fix.
- Compare first/latest campaign fields to see where qualifying traffic came from. An untagged direct
  return retains prior attribution; campaign labels must come from the approved allowlist.
- Separate fatal render failures, client errors and functional errors. Count affected users as well
  as events so one noisy browser does not dominate the story.
- Choose one evidence-backed improvement, then collect a comparable post-release cohort.

Replay and autocapture are enabled, with typed inputs masked. UI text and interaction metadata can
still be collected; do not describe this as “no data collected.” DNT and the analytics opt-out apply.
Do not create alerts or declare an issue fixed merely because a new event is named in code.

For exact event meanings, use [Event Reference](analytics/EVENT_REFERENCE.md). For ordered funnels,
request/run correlation and retention definitions, use [Funnels](analytics/FUNNELS.md). The frozen
[July baseline](analytics/BASELINE_W1.md) preserves past figures under its old definitions; it is
not a valid comparison to the new instrumentation without reconciling those differences.
