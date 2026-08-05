# PostHog Guide for QuickSign (for a first-time, non-technical founder)

> You don't need to be technical to use PostHog well. This guide teaches the concepts using
> QuickSign's own data, then gives you copy-paste "how do I answer this question?" recipes and a
> weekly routine. Goal: **make product decisions from data, not vibes.** Pairs with
> `LAUNCH_STRATEGY.md` and `docs/MULTIPLAYER_RUNBOOK.md`.

Your project: PostHog US Cloud, org "QuickSign", project 518794. Log in at https://us.posthog.com.

---

## 1. The mental model (30 seconds)

PostHog records **events** ("someone did X") tagged with **properties** ("on this screen, this
browser"). Everything else — dashboards, funnels, retention — is just *questions asked over those
events*. QuickSign sends ~42 event types (see `docs/analytics/EVENT_REFERENCE.md`). You never write
code to analyze them; you build **Insights** (saved questions) and pin them to **Dashboards**.

Anonymous → identified: a visitor is anonymous until they sign in, then their pre-signup activity is
linked to their account (via `alias`). So you *can* see "did guests who later signed up behave
differently" — that's a cohort question (§6).

---

## 2. The core metrics, in QuickSign terms

- **DAU / WAU / MAU** — Daily / Weekly / Monthly Active Users: unique people who did *something* in
  that window. In PostHog, a Trends insight counting unique users on `screen_viewed` per day = DAU.
  *QuickSign use:* "are we growing or is the launch spike decaying?"
- **Stickiness** — of the people active this week, how many days did they show up? High stickiness =
  habit forming. *QuickSign:* a learning app lives or dies on this.
- **Churn** — the opposite of retention: users who were active and stopped. *QuickSign:* a Reddit
  spike churns fast by default; your job is to bend that curve.
- **Retention** — of people who did X on day 0, what % come back on day N. **This is your north-star
  metric** (D2 return especially). PostHog has a dedicated Retention insight.
- **Conversion** — % who move from one step to the next (e.g. landed → finished a lesson). Measured
  with **Funnels**.
- **Funnel** — an ordered set of steps; PostHog shows the % making it through each, and *where they
  drop*. Your Activation funnel is the most important object in the whole project.
- **Feature flag** — a remote on/off (or %) switch for a feature, no redeploy. You have 14 (rollout +
  kill switches). Flip a kill switch to disable a broken feature instantly.
- **Experiment (A/B test)** — a feature flag + a metric + statistics: show variant A to half, B to
  half, see which wins. *QuickSign:* "does shorter onboarding raise first-lesson completion?"
- **Cohort** — a saved group of users defined by behavior ("finished ≥1 lesson", "returned on D2",
  "used multiplayer"). You compare metrics *across* cohorts to find what drives retention.

---

## 3. The dashboards to build (and what each answers)

Build these in PostHog (+ New dashboard → add insights). Start with the first three before launch;
the rest can wait. Each row is one insight to add.

| Dashboard | The question it answers | Key tiles |
|---|---|---|
| **Launch Day** ⭐ | "Is the launch working, right now?" | Live DAU, Activation funnel conversion, first-correct-sign count, crash/error count, camera-grant rate, top screen drop-off |
| **Activation** ⭐ | "Do new users reach value?" | Full Activation funnel (§4), first-lesson completion %, guest vs signed-in split, time-to-first-correct-sign |
| **Retention** ⭐ | "Do they come back?" | D1/D2/D7/D30 retention, Lifecycle (new/returning/resurrecting/dormant), Stickiness |
| **Learning** | "Are they actually learning?" | `lesson_completed` by world, skip rate, avg hints, `sign_attempt` success rate by sign |
| **Recognition / AI** | "Is the recognizer trustworthy?" | avg `ai_confidence`, `ai_vetoed` rate, `sign_attempt` fail-rate by sign, `ai_model_unavailable` count |
| **Multiplayer** | "Does multiplayer work, do we need paid TURN?" | `used_relay` rate, `ice_failed` rate, match started→finished funnel, `connection_time_ms` |
| **Errors** | "Is it breaking for real users?" | `fatal_error`/`session_crashed`/`unexpected_reload` trend, breakdown by browser/device |
| **Performance** | "Is it fast?" | Web Vitals (auto-captured), `ai_model_loaded.load_ms` distribution |
| **Acquisition** | "Where do users come from?" | `landing_view` by referrer/UTM, CTA click-through, in-app-browser hit rate |
| **Monetization (future)** | placeholder | (subscription events are typed but not emitted yet — build when monetization ships) |
| **Weekly Review** | "What changed vs last week?" | Week-over-week DAU, retention cohort, top failed signs, new feature requests |
| **Monthly Review** | "Are we building the right thing?" | MAU trend, D30 retention, cohort comparisons, funnel trend over the month |

---

## 4. The Activation funnel (build this first)

Product Analytics → New insight → Funnel. Steps, in order:
`landing_view` → `screen_viewed` (screen=home) → `lesson_started` → `sign_attempt` (final_passed=true)
→ `lesson_completed` → return `screen_viewed` on a later day (D2).
Break down by `skill_level` (from `onboarding_completed`) to see if beginners drop faster. **The step
with the biggest % drop is your #1 fix** — always.

---

## 5. "How do I answer…" — exact recipes

Each: Product Analytics → New insight → the type named.

- **Where are users leaving?** → Funnel (the Activation funnel above). The biggest drop = the answer.
- **Which lessons are hardest?** → Trends on `lesson_completed` vs `lesson_started`, broken down by
  `lesson_id`/`world_id`. Low completion ratio = hardest.
- **Which signs fail the most?** → Trends on `sign_attempt`, break down by `sign_id`, filter
  `final_passed = false`. Sort descending. (These are your recalibration targets — see `/new-sign`.)
- **Which browser causes the most bugs?** → Trends on `fatal_error` + `session_crashed`, break down by
  `$browser`. (Auto-captured property.)
- **Which devices struggle?** → same, break down by `$device_type` / `$os`.
- **Does multiplayer improve retention?** → Create a cohort "used multiplayer" (did
  `multiplayer_match_started`). Retention insight, compare that cohort vs everyone. Higher curve = yes.
- **Do guest users convert?** → Funnel `guest_started` → `signup_completed`. The % is your answer.
- **Should I buy a TURN server?** → Trends on `multiplayer_ice_connected`, break down by `used_relay`.
  If `used_relay=true` is <~10% → no. If 30–60% with rising `ice_failed` → yes. (Runbook §5.)
- **Should I build Feature A or B?** → don't guess — ship both behind flags to a slice, or run an
  Experiment; compare each on first-lesson completion / retention. Whichever moves the north star wins.
- **Which features are never used?** → Trends on each feature's entry event (e.g. `shop` screen views,
  `speed_session_started`); the near-zero ones are dead weight — cut or fix.

---

## 6. Cohorts to create (People → Cohorts → New)

- **Activated** — completed `lesson_completed` ≥ 1.
- **Returned D2** — active on a day ≥1 day after first seen.
- **Multiplayer users** — did `multiplayer_match_started`.
- **In-app-browser hit** — (once you add a property/event for it) users flagged by the banner.
Then use these in Retention insights to see *what behavior predicts coming back*. That's how you decide
what to build next.

---

## 7. Alerts to set up (get told before users tell you)

PostHog → the insight → Subscribe/Alert. Recommended:
- **Crash spike:** `fatal_error` + `session_crashed` per hour exceeds a threshold → email you.
- **Camera failures:** `camera_error` rate jumps (a browser/deploy broke the camera).
- **Recognition broken:** `ai_model_unavailable` count > 0 (the model CDN failed).
- **Multiplayer failing:** `multiplayer_ice_failed` rate high (TURN saturated).
- **Retention drop:** weekly D2 retention falls below your baseline.
- **Traffic spike:** DAU jumps (a post took off — be present to support it).
Also enable **PostHog Error Tracking** (Settings) so exceptions are grouped/triaged automatically, in
addition to your custom crash events.

---

## 8. Your weekly analytics routine (15 minutes)

1. Open the **Weekly Review** dashboard. WoW DAU: up or down?
2. **Retention** dashboard: is D2/D7 improving, flat, or bleeding? (This is the real health signal.)
3. **Activation** funnel: did the biggest drop-off move? What's #1 now?
4. **Recognition:** top 3 failed signs this week → queue recalibration.
5. **Errors:** any new crash cluster by browser/device?
6. **Multiplayer:** `used_relay` trend → revisit the paid-TURN decision.
7. Read the week's feature requests/feedback (admin dashboard + PostHog surveys once added).
8. Pick **one** change for next week that most improves D2 retention. Just one. Ship it behind a flag.

**The habit that matters:** every week, let the funnel's biggest drop-off and the D2 retention number
choose your next task. Don't build from opinion when you have the data to decide.

---

## 9. What's already set up vs. still to build

**Done (live in PostHog):** 14 feature flags (rollout + kill switches), 3 funnels (Activation,
Learning, Multiplayer), 1 dashboard (Executive/Activation), and verified event ingestion (production
events arriving with correct properties + identity).

**To build (this guide tells you how; it's click-work, not code):** the remaining dashboards in §3,
D1/D7/D30 Retention + Lifecycle + Stickiness insights, the cohorts in §6, the alerts in §7, PostHog
Surveys (exit "what stopped you?" + NPS), and enabling Error Tracking. None require a code change —
the events are already flowing.
