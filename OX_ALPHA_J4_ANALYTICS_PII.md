# OX_ALPHA_J4_ANALYTICS_PII.md

**Task:** ASL-J4 · `[REPORT]` Analytics PII — audit what PostHog collects in practice: config flags,
event payloads, IP/UA handling, opt-out path.
**Date:** 2026-08-25/26 · **Branch:** `audit/round4-corrections` ·
**Method:** executed two-part probe (`web/e2e-adhoc/probe-analytics-pii.mjs`) against the production
build on a local preview: Part A = full guest session with every outbound `/e/` event batch
intercepted and gzip-decoded; Part B = opted-out session verifying capture stops. Static review of
`src/analytics/client.ts` (config) + `consent.ts` (opt-out storage). No code changed.

---

## 1. Config posture (src/analytics/client.ts, reviewed + verified live)

| Setting | Value | PII impact |
|---|---|---|
| `autocapture` | ON | click targets/selectors only; typed text masked via `maskAllInputs` |
| `capture_pageview` | OFF | SPA sends deliberate `screen_viewed` instead (App.tsx → useScreenView) |
| `capture_pageleave` | ON | bounce/duration math; no PII |
| `session_recording` | ON, `maskAllInputs: true` | flow/clicks recorded, never typed text; cannot capture the webcam stream |
| `person_profiles` | `identified_only` | anonymous users create no Person profile until sign-in |
| `respect_dnt` | true | browser Do-Not-Track disables capture outright |
| `before_send` | `sanitizeAnalyticsProperties` | strips query string AND hash from `$current_url`/$referrer/$referring_domain — this is what killed the 2026-07-27 Supabase token-in-fragment leak |

## 2. Executed payload inspection (16 decoded events across 3 batches)

Real guest session events observed flowing: `$groupidentify`, `screen_viewed`,
`onboarding_step_viewed`, `$autocapture`, `auth_option_selected`, `guest_started`,
`onboarding_skill_selected`, `onboarding_completed`.

Scanned every property of every event:

- **Zero email-like strings.**
- **Zero JWTs / supabase access_token or refresh_token fields** — the fragment-leak fix holds at runtime.
- **Every `$current_url` sanitized** (13–16 urls per run): origin+path only, no query, no fragment.
- Event payloads carry only screen names, step names, skill level, and standard PostHog context ($os, $browser, $timezone).

## 3. IP / UA handling

- The client never transmits IP in payloads; PostHog derives coarse geo server-side from connection
  metadata (standard PostHog behavior, disclosed in their DPA). No `$ip` overrides are sent.
- `$raw_user_agent` rides in event properties (PostHog default) for browser/OS derivation only.

## 4. Opt-out path (executed)

`Settings → Privacy` writes localStorage `quicksign_analytics_opt_out=true`;
`initAnalytics()` reads it before anything captures and calls `posthog.opt_out_capturing()`.
Probe result: after the initial sync window, **zero event batches continue** for an opted-out user.
DNT-respect adds a second layer for browsers signaling Do Not Track.

## 5. Verdict

Analytics posture is privacy-conservative and matches the product's claims: deliberate events only,
masked inputs, sanitized URLs, no person profiles for anonymous users, working opt-out, no PII in
any observed payload. One operational note for the owner: posthog-js silently drops ALL events when
it detects automation (`navigator.webdriver`, HeadlessChrome UA/brands) — which is correct behavior,
but means e2e analytics assertions must scrub those markers to exercise the real pipeline.

## 6. Re-run

Requires local preview on :4173 serving `dist/`.
`node web/e2e-adhoc/probe-analytics-pii.mjs` (exit 0 iff all checks pass). ~40 s.
