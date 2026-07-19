# Developer Guide — Adding an Analytics Event the Right Way

## Adding a new ACTIVE event

1. **Check it doesn't already exist** (see `EVENT_REFERENCE.md`) — prefer adding a property to an
   existing event over inventing a near-duplicate.
2. Add the name to `web/src/analytics/events.ts`'s `EVENTS` object (key === value, enforced by
   `analytics/tests/events.test.ts`).
3. Add its payload shape to `EventPayloads` in `web/src/analytics/types.ts`. No `any`, no loose
   `Record<string, unknown>` — every property typed.
4. Call `track('your_event', { ... })` **at the real call site** — inside an event handler, an
   effect, or a store action. **Never inside a component's render body** (that fires on every
   re-render, not once per real occurrence).
5. If the event needs to know about a feature that doesn't exist yet, it doesn't belong in
   `EVENTS` — add it to `FUTURE_EVENTS`/`FuturePayloads` instead and leave it unemitted.

## Adding a FUTURE (planned) event

Add the name to `FUTURE_EVENTS` and the payload to `FuturePayloads` in `types.ts`. Do **not**
call `track()` with it — `track()`'s generic type only accepts `ActiveEventName`, so this is a
compile error by construction, not just a convention.

## Rules (enforced by the self-audit test suite, `analytics/tests/`)

- **Never call `posthog.capture()` directly.** Only `capture.ts` may. Everyone else imports
  `track` from `@/analytics`. (`noDirectCapture.test.ts` fails the build if this is violated.)
- **Never track in render.** Put `track()` calls in `useEffect`, event handlers, or store
  actions — never in the JSX return / component body directly.
- **No PII.** No email, password, username-in-event-properties, raw landmarks, video, or full
  error stacks. If you're unsure whether a value is PII, don't send it.
- **Guest-inclusive by default.** Most product events (lessons, sign attempts, screen views)
  should fire for guests too — the activation funnel needs anonymous data. Gate on `user` only
  for genuinely account-scoped things (Supabase writes, not PostHog events).
- **One event per real occurrence.** See `NAMING_CONVENTION.md` — don't split an event into
  `_passed`/`_failed` variants; use a boolean property.

## Testing your event locally

Set in `web/.env.local`:
```
VITE_POSTHOG_KEY=<your project token>
VITE_ANALYTICS_DEV=1
```
Then `npm run dev` (or `npm run preview` after a build) and check PostHog's Activity view for
your project — events should arrive within a few seconds. Unset `VITE_ANALYTICS_DEV` (or leave
`VITE_POSTHOG_KEY` blank) to go back to the normal silent-in-dev behavior.

## Feature flags

Add the key to `FEATURE_FLAGS` in `featureFlags.ts`, create the flag in the PostHog UI, then read
it with `useFeatureFlag('your_flag', defaultValue)` in a component, or `isKillSwitchOn('...')` in
a non-component module (hooks that aren't React components, like `useCamera.ts`'s internals).
Always pass a safe default — a PostHog outage must never break the feature the flag controls.
