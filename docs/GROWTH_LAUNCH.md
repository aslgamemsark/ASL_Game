# Growth Launch — Metrics & Interpretation Guide

What to watch during and after a launch push, and how to read it. Companion to
`docs/analytics/FUNNELS.md` (the funnel definitions) and `docs/MARKETING_ANALYTICS.md` (UTM
conventions) — this doc is about *cadence and interpretation*, not event definitions.

## Context: the existing baseline is now stale

`docs/analytics/BASELINE_W1.md` recorded a real Week 1 baseline (frozen 2026-07-27, 52 non-PK
users): **A8/A1 = 1.9%** activation (users who touched the app → completed a lesson), with the
steepest single drop at A5 (skill step → only 1 of 6 who reached auth got that far).

That funnel was measured against the **pre-launch-readiness architecture** — `/` served the app
directly, auth came before any real value, and the canonical activation event
(`first_sign_success`) didn't fire from onboarding at all. The 2026-08-31 changes (this document's
own launch) restructured exactly those steps: `/` is now marketing, first-sign happens before
auth, and `first_sign_success`/`sign_attempt` now fire from onboarding. **Do not compare a
post-launch funnel directly against W1's row-for-row percentages** — the steps themselves changed
shape. Treat W1 as historical context ("here's how bad the old flow was"), and treat the first
week of real launch traffic as the new baseline going forward.

## The canonical funnel (current)

From `docs/analytics/FUNNELS.md`, in order:

```
landing_view (/)
  → hero_cta_clicked
  → screen_viewed (screen=onboarding)
  → first_sign_started
  → sign_attempt (source=onboarding, final_passed=true) / first_sign_success
  → onboarding_completed
  → lesson_started (first real lesson)
  → lesson_completed (first)
  → return screen_viewed on a later calendar day (Day-2 retention)
```

Every step from `hero_cta_clicked` onward carries `first_touch_utm_*`/`session_utm_*` super
properties — break any step down by `first_touch_utm_source` to see which channel is actually
producing activated users, not just clicks.

## What to watch, and how often

**During an active launch push (first 48-72 hours of a specific post — Product Hunt day, a Reddit
post, etc.):** check every few hours, not continuously. The numbers are too small in the first
couple hours for anything but gross errors (a broken build, a 404 CTA, zero events at all) to be
visible — checking every 15 minutes just produces noise-chasing.

- **Is anything firing at all?** `landing_view` count > 0 within the first 10 minutes of a post
  going live. Zero is a real launch blocker (broken deploy, wrong URL posted, PostHog misconfigured
  — see the Human Actions below) and the single most urgent thing to catch fast.
- **`hero_cta_clicked` / `landing_view`** — the landing page's own conversion rate. A sharp drop
  from what a manual click-through test showed is a real regression signal (broken CTA, JS error),
  not a "traffic is different" story.
- **`first_sign_started` / `hero_cta_clicked`×`onboarding` screen_viewed** — how many people who
  clicked actually reached the interactive moment. A near-zero rate here with real traffic present
  points at a camera-permission or loading problem, not disinterest.
- **`first_sign_success` count** — the real activation number. This is the metric to report, not
  `landing_view` or signups.

**Ongoing (weekly), once launch-day traffic has settled:**

- Full funnel, broken down by `first_touch_utm_source` — which channel's traffic actually converts,
  not just which channel sent the most clicks.
- Day-2/Day-7 retention (`guest_return`/`login` gap-day properties) — a launch spike that doesn't
  return is acquisition without product-market signal.
- `sign_attempt` aggregate quality (avg confidence, avg attempts-to-success, `ai_vetoed` rate) —
  whether the *product itself* is holding up under real, unfamiliar-to-the-team traffic, not just
  whether people showed up.

## Reading a bad number correctly

A launch push is small-sample by nature. Before treating any single-day drop as a regression:

- Check the **denominator**. A funnel step going from "3/5" to "1/8" reads as a collapse but is two
  people's worth of noise. Don't act on day-over-day swings under ~30-50 events in a step.
- Check **channel mix** first. If a new channel (say, a much colder Reddit audience than the
  original beta testers) enters the traffic mix, a lower blended activation rate can be entirely
  explained by audience quality, not a broken product — this is exactly why the UTM breakdown
  above matters more than the blended number.
- Check **deployment_environment**. `client.ts` separates `production`/`preview`/`development` as a
  super property specifically so preview-deploy testing traffic (yours, during launch-day fixes)
  never silently pollutes the real numbers — confirm you're filtering to `production` before
  reacting to anything.

## Human actions before trusting any of this

These cannot be verified from the repository — see the launch-readiness plan's Human Actions
section for the full list, but the two that block trusting analytics specifically:

1. **Confirm the app's `VITE_POSTHOG_KEY` (Vercel env) matches the static marketing pages'
   hardcoded key** (`phc_mDKbcv…` in `home.html`/`asl-alphabet.html`). If they differ, marketing and
   app visitors are two different PostHog persons with no linkage — the funnel above cannot stitch
   past `hero_cta_clicked`, and everything downstream of it will look like it drops to zero even if
   the product is working fine.
2. **Confirm PostHog's "Record user sessions" project toggle** is in the state you want before
   launch — session recording is coded as on (`disable_session_recording: false` in `client.ts`)
   but gated by that project-level setting too.
