# Funnels and trustworthy denominators

_Reviewed 2026-09-19 against current code. These are measurement definitions, not a claim that
new events have shipped or that all saved remote insights already use these definitions._

## Shared filters

For current external production behavior, require **all three**: canonical hostname
`quicksignn.vercel.app`, `deployment_environment = production`, and `traffic_type = external`.
Exclude missing/unknown historical traffic tags from this clean segment; report them separately
rather than treating “not internal” as external. Do not exclude a country as a proxy for testers.
Internal markers are explicit and device-scoped, so unmarked staff traffic can still contaminate data.

Separate releases with `git_commit` and activation with `flow_version = 3`. Record the time window,
timezone, unique-user/session unit and funnel conversion window with every result. Events absent
before their release are missing coverage, not evidence of zero failure. Do not mix raw event-count
ratios with ordered user conversion.

## Activation: first learning value

For new onboarding visitors: `onboarding_step_viewed` (`step=welcome`) → `first_sign_success`
(`flow_version=3`). Break down successful events by `source` and `identity_scope`.
The first success may happen in onboarding **before** auth, `onboarding_completed`, `lesson_started`
or Home. Requiring those earlier steps would discard valid activation.

Inspect the onboarding substeps separately: welcome → skill → firstSign; then compare first-sign
success, auth choice and completion. A visitor can skip the camera and still finish onboarding.
`guest_started` occurs at the auth choice; it is not all visitors or the start of onboarding.
For traffic arriving on a marketing page, inspect its own landing → CTA funnel, then app entry;
do not require `landing_view` for users who enter the app directly.

`first_sign_success` is the first accepted sign per guest/account on a browser, not a globally
unique lifetime achievement. Storage clearing, shared devices and cross-device use affect counts.
Historical unversioned events excluded onboarding; v2 was browser-wide; v3 changes identity scope.

## Lesson outcomes

Use an ordered `lesson_started` → `lesson_completed` funnel, holding `lesson_id` constant; segment
by world. Report `correct`, `total`, `skipped` and XP alongside completion. Completion can include
skips and is not mastery. Prompt skips differ from the separate cost-bearing `lesson_skipped` action.
A person funnel cannot pair every repeated session of one lesson perfectly; use a session-limited
window and state that limitation rather than treating raw completed/started counts as conversion.

## Camera and recognition health

- Join `camera_requested` to `camera_first_frame` using `camera_request_id`; first-frame time measures
  usable video startup, not permission alone. Permission, error and stall events provide context
  by screen; they do not all carry that request id.
- `recognition_model_initialized` measures MediaPipe initialization, with ready/error outcomes.
  It is separate from the disabled optional ML classifier's `ai_model_*` events.
- Match `recognition_run_started` / `recognition_run_ended` by `run_id`. Report accepted, skipped,
  interrupted, sign_changed and unmounted outcomes plus starts lacking an end. A run is a started
  recognition loop, not one physical signing try. Abrupt tab loss may prevent an end event.
- Ended-run acceptance is accepted ends / all observed ends; report unmatched starts alongside it.
  `last_failing_parameter` is a final diagnostic observation, not ground-truth error attribution.
- `sign_attempt` contains rule-pass gate decisions only. Its `final_passed` rate omits rule failures
  and skips, so it is neither overall recognition accuracy nor the denominator of physical attempts.
  Optional ML loading/enforcement are disabled. A veto, if measured in a future experiment, would
  still need qualified labels before being called a false positive or false negative.
- Reference playback/error events measure clip availability and playback, not educational correctness.

## Retention is a separate insight

Start a retention cohort at v3 first success and measure later learning activity, such as
`lesson_started` or `practice_session_started`, separately from general `screen_viewed` returns.
Define D2 precisely: for a first-use day called Day 1, it means the next calendar day in the chosen
timezone (PostHog's day-offset 1). Do not silently substitute “any later day” or a 48-hour window.
Only include cohorts old enough to finish the return window. Report D7 with its explicit day offset.
`guest_return.gap_days` is days since the last device visit, not cohort retention by itself.

## Auth and multiplayer

Email: `signup_started` → `signup_submitted` measures request progression; submission is not a
confirmed account. Google: `auth_started` → `login` measures auth intent to observed sign-in, not
new-user signup. Use identity-linked cohorts for guest-to-account behavior and acknowledge that
new versus returning accounts need authoritative auth data.

Multiplayer: entry screen → room created/joined → match started → match finished. Hold `room_id`
constant where supported and split by `mode`. Report abandoned/disconnected matches separately.
ICE relay use and failures diagnose connectivity, not whether multiplayer caused higher retention.
