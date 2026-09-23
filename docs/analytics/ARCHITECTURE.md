# Analytics architecture

_Code contract reviewed 2026-09-19; this is not evidence that the current changes are deployed._

The app uses the centralized `web/src/analytics/` API. Static marketing pages load the SDK
separately and share `web/public/analytics-context.js` for attribution and redaction. Keep those
entry paths consistent. [Event definitions](EVENT_REFERENCE.md) describe what can be measured;
[the founder guide](../POSTHOG_GUIDE.md) explains how to use the data.

## Owners

| File | Responsibility |
|---|---|
| `events.ts`, `types.ts` | Implemented event names and typed payloads; no speculative event registry |
| `capture.ts` | `track`, identity transitions, consent application and queued SDK operations |
| `client.ts` | Lazy SDK initialization, ordered readiness callbacks, release context and privacy configuration |
| `AnalyticsIdentityBridge.ts` | Plain `syncAnalyticsIdentity` function called by authoritative AuthContext callbacks; it is not a mounted React component |
| `firstSuccess.ts` | Device-local v3 first-success state for the current guest/account |
| `attribution.ts`, `trafficType.ts`, `public/analytics-context.js` | Safe first/latest acquisition fields, explicit tester marker and URL redaction |
| `consent.ts` | Persisted opt-out; `useScreenView.ts` tracks SPA screen transitions |
| `featureFlags.ts`, `useFeatureFlag.ts` | Typed flag reads with safe defaults |
| `hooks/useAttemptLog.ts` | Shared rule-pass reporting across learning surfaces; separate account-gated Supabase persistence |

## Initialization, identity and consent

`VITE_POSTHOG_KEY` plus a production build or `VITE_ANALYTICS_DEV=1` enables initialization.
Until the dynamically imported SDK is ready, tracking and identity operations queue in call order.
SDK acceptance is not proof of server ingestion; the queue is memory-only and a failed import or
closed tab can lose events. Consent is checked again before queued capture executes.

AuthContext calls `syncAnalyticsIdentity` before its login/product events. A guest is anonymous;
`identifyUser` identifies the authenticated Supabase user id and lets PostHog link that anonymous
history. There is no manual alias call. An account switch resets an existing different account
before identification; logout resets to an anonymous identity. Release, attribution and beta
cohort context are restored after resets. Current identification supplies provider, account age,
plan and language; username and country are null. Do not infer email or username capture.

Opting out stops capture; opting back in reapplies the desired account or clears a stale identified
session. DNT is respected. Missing configuration, blocked storage, browser protections and opt-out
all limit coverage. Anonymous identity and activation deduplication are browser-local, not proof
of unique humans across devices or shared browsers.

## Privacy boundary

Current SDK configuration enables **session replay with `maskAllInputs: true`** and **autocapture**.
UI structure, rendered text and interaction metadata can still be observed; input masking is not
a blanket guarantee that no personal data is collected. Replay also depends on project settings.
Use deliberate typed events for product funnels; automatic click events are diagnostic context.

SPA automatic pageviews are disabled; `screen_viewed` is manual. Pageleave and Web Vitals capture
are enabled. The app's event payloads must not contain webcam frames, landmark arrays, credentials,
free-form messages or full stacks. URL query strings/fragments and credential-like properties are
redacted before sending; campaign fields are allowlisted. A local recognition architecture does
not mean the application's multiplayer or training-data features never transmit information.

## Acquisition and release context

`app_version`, `git_commit`, `deployment_environment`, `build_timestamp` and `traffic_type` are
registered context. `first_*` and `latest_*` acquisition properties contain only approved campaign
labels, referrer origin and landing path. First touch is retained; a later qualifying campaign or
external referrer updates latest touch. An untagged direct visit does not erase it.

Allowed campaign keys are `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
and `campaign_id`. Values are bounded labels; URLs, email-like strings and token-like values are
rejected. App entry links copy only those approved current fields and the explicit internal-test
marker, not arbitrary parameters or auth fragments. Both marketing pages and the app use this helper.
`?internal=1` marks a tester on that browser; `?internal=0` clears the marker. Country is not a tester flag.

For population filters, version boundaries and valid denominators, use [Funnels](FUNNELS.md).
