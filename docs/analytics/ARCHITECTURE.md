# Analytics Architecture

QuickSign's analytics run on PostHog, wired through one centralized module:
`web/src/analytics/`. No file outside that module calls PostHog directly.

## Why centralized

The project has already paid for scattered logic once (the COFFEE recognition bug — see
CLAUDE.md). Analytics gets the same discipline: one typed `track()` function, one place that
knows what "disabled" means, one place that knows the privacy rules. A new event is a new line
in `events.ts` + `types.ts`, not a new `posthog.capture()` call invented at the point of use.

## Module map

| File | Owns |
|---|---|
| `client.ts` | PostHog init, privacy config, `sanitizeAnalyticsProperties`, `getPosthog()` (internal accessor) |
| `events.ts` | Event **names** — the only place a string literal event name may exist. Split into `EVENTS` (ACTIVE, emitted) and `FUTURE_EVENTS` (documented, never emitted). |
| `types.ts` | `EventPayloads` — one typed payload interface per ACTIVE event; `FuturePayloads` for planned-but-unbuilt events |
| `capture.ts` | The **only** sanctioned capture surface: `track()`, `identifyUser()`, `aliasAnon()`, `resetIdentity()`, `setGroup()`. Enforced by `analytics/tests/noDirectCapture.test.ts`. |
| `consent.ts` | Opt-out state (localStorage), independent of PostHog itself |
| `featureFlags.ts` | Typed flag keys + `isKillSwitchOn()` (non-hook, for hooks/modules) |
| `useFeatureFlag.ts` | React hook version of flag reads, with a safe default |
| `useScreenView.ts` | Fires one `screen_viewed` per navigation |
| `useAnalytics.ts` | Hook wrapper around `capture.ts`'s functions |
| `AnalyticsIdentityBridge.tsx` | Mounted once in `main.tsx`; syncs PostHog identity to Supabase auth state |

## Privacy posture (locked — do not loosen without re-reviewing)

QuickSign's product promise is "your camera never leaves your browser." Analytics config
mirrors that:

- **No session replay** (`disable_session_recording: true`), ever.
- **No autocapture** — every event is a deliberate `track()` call with a typed payload.
- **No automatic pageviews** — this is a `screen` state-machine SPA, not route-based; one manual
  `screen_viewed` per navigation instead.
- **Anonymous by default** — `person_profiles: 'identified_only'`. A guest generates events but
  no Person profile forms until they sign in.
- **DNT respected.**
- **A user-facing opt-out** exists (Settings → Privacy → "Anonymous usage analytics"), backed by
  `consent.ts`, disclosed on the Privacy & Terms page.
- **Never captured:** email, password, raw hand landmarks, video, full error stacks.

## Gating

Analytics only initializes when `VITE_POSTHOG_KEY` is set AND (`import.meta.env.PROD` OR
`VITE_ANALYTICS_DEV=1`). Every function in `capture.ts` is a safe no-op when analytics isn't
configured — no call site anywhere in the app needs its own "is analytics ready" guard.

## Identity flow

1. Anonymous browsing → PostHog assigns an anonymous distinct id, events flow under it.
2. User signs up/logs in → `AnalyticsIdentityBridge` calls `aliasAnon(user.id)` (links the
   anonymous history to the account) then `identifyUser(...)`.
3. Sign-out → `resetIdentity()` — a fresh anonymous id starts, so a guest on a shared device
   after a logout isn't attributed to the account that just left.

## Session/release metadata

Set ONCE per session via `posthog.register()` (super properties), not threaded into every
`track()` call: `app_version`, `git_commit`, `deployment_environment`, `build_timestamp`
(injected at build time via `vite.config.ts`'s `define` block, sourced from Vercel's
`VERCEL_GIT_COMMIT_SHA`/`VERCEL_ENV` in production). Device/browser context uses PostHog's
built-in `$browser`/`$os`/`$device_type` properties, also captured once per session, not
recomputed per event.

## Groups

`beta_cohort` (registered on every session — the whole beta population), `country`/`language`
(registered on identify, from existing region/locale detection). `organization` is a typed
placeholder for future team/classroom accounts — declared, not populated.
