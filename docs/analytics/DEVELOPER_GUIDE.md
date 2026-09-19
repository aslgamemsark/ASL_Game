# Adding or changing analytics

_Code contract reviewed 2026-09-19. Source code and its real call sites are authoritative._

1. Check [the event reference](EVENT_REFERENCE.md); prefer a useful property to a duplicate event.
2. Add an implemented event to `EVENTS` in `web/src/analytics/events.ts` and its flat payload to
   `EventPayloads` in `types.ts`. Add it alongside the actual call site, not before a feature exists.
3. Call `track('event_name', payload)` from a handler, effect or store mutation, never render.
   App callers import from `@/analytics`; only the central wrapper captures directly. Unbundled
   marketing pages are a deliberate exception and must retain the shared privacy/attribution helper.
4. Define what one event means, its denominator, deduplication and missing-data cases. If meaning
   changes, document the version boundary; do not silently reinterpret historical events.
5. Add the smallest behavioral regression and update the owning documentation.

## Existing paths to reuse

- Use `useAttemptLog` for sign decision reporting. Do not add a second page-level `sign_attempt`
  or `first_sign_success`. Failed physical tries are not implicitly counted by that event.
- Recognition run start/end telemetry belongs in `useRecognition`, camera request/frame telemetry
  in `useCamera`, and reference playback telemetry in `ReferenceClip`.
- Identity belongs in `syncAnalyticsIdentity` called by AuthContext. Do not identify in a delayed
  profile-fetch response or UI effect; account changes must precede queued product events.
- `track` can accept work into the local SDK-readiness queue. Its return value is not a PostHog
  server acknowledgement. First-success deduplication marks storage only after SDK acceptance.
- Preserve consent checks both when queued and when captured. Never manually rewrite the auth
  URL to sanitize it; Supabase needs that fragment. Redact at the analytics boundary.

Keep events free of credentials, emails, message bodies, webcam data and landmark arrays. Guests
should contribute to product analytics under consent; Supabase writes remain separately gated.
Do not equate AI votes, completed screens or run outcomes with independently verified ASL accuracy.

## Verify

Run the relevant analytics tests, `npm run test:first-learning` for affected learning flows, and
`npm run build` in `web/`. For a manual local ingestion check, set a project token and
`VITE_ANALYTICS_DEV=1`, then visit with `?internal=1`. Confirm actual event properties in PostHog;
local tests alone do not prove live ingestion. Remove the local opt-in when finished.

Feature flags use `FEATURE_FLAGS`, `useFeatureFlag` and `isKillSwitchOn`. A `disable_*` flag set
to true disables its wired feature; an unavailable flag defaults to false. A declared flag without
a call site controls nothing. Check the actual UI reader before describing a remote flag as active.
