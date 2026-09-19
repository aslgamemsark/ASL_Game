# Analytics naming and meaning

- Events and properties use `snake_case`. Name the observed action, not a stronger inferred claim:
  `signup_submitted` is a request outcome; `client_error` is an error, not necessarily a crash.
- Reuse a single event with an outcome property where appropriate. Start/end pairs describe a
  lifecycle and use a correlation id (`run_id`, `camera_request_id`) where implemented.
- IDs end in `_id`; elapsed milliseconds end in `_ms`. The legacy
  `first_sign_success.ms_since_lesson_start` actually measures from the reporting screen's mount,
  including onboarding; do not call it time since app entry or pure recognition latency.
- Every event needs an explicit unit and denominator. `sign_attempt` counts rule-pass decisions;
  recognition runs count started loops. Neither enumerates physical signing attempts.
- `flow_version` separates changed activation semantics. Historical versions are not silently
  reinterpreted as the newest one.
- Use affirmative booleans (`final_passed`, `ai_vetoed`, `won`). No credentials, emails, free-form
  messages, webcam frames or landmarks in payloads. Use approved identity and attribution helpers.
- Keep screen/source values in `types.ts`. Attempt source distinguishes onboarding, lesson,
  practice, story, speed, duel and room; screen and source are different dimensions.
- Only implemented events belong in `EVENTS`/`EventPayloads`. Planned products do not need event
  placeholders. Feature flags need a real reader before they control anything.
- Feedback category events deliberately co-fire with `feedback_submitted`; do not add those counts
  together and call them unique submissions.
