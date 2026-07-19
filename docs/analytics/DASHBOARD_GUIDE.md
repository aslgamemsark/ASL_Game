# Dashboards

Eight dashboards, each answering a different team's question. Built in PostHog via the MCP
connector; recreate manually here if needed (each row = one insight to add).

| Dashboard | Answers | Key insights |
|---|---|---|
| **Executive / Activation** | Is the beta growing? | DAU/WAU trend, `onboarding_completed` count, Activation funnel conversion, guest vs. signed-in split |
| **Learning** | Are people actually learning? | `lesson_completed` volume by `world_id`, `lesson_skipped` rate, avg `hints_used`, Learning funnel |
| **Recognition / AI quality** | Is the recognizer trustworthy? | avg `ai_confidence` on `sign_attempt`, avg `duration_ms` (recognition latency proxy), `ai_vetoed` rate (suspected false-positive rate — see the honest caveat in `EVENT_REFERENCE.md`), `ai_model_unavailable` count |
| **Multiplayer** | Is multiplayer working? | `multiplayer_match_started` vs. `_finished` vs. `_abandoned`, `multiplayer_connection_lost` rate, avg match `duration_ms` |
| **Errors** | Is the app breaking for real users? | `fatal_error`/`session_crashed`/`unexpected_reload` trend, `error_captured` by `source`, breakdown by `deployment_environment` |
| **Performance** | Is the app fast? | Web Vitals (LCP/CLS/INP/FCP/TTFB, auto-captured), `ai_model_loaded`'s `load_ms` distribution |
| **Growth / Retention** | Are people coming back? | Lifecycle chart (new/returning/resurrecting/dormant) on `screen_viewed`, Day-2/Day-7 retention |
| **Economy** | Is the reward loop healthy? | `level_up` rate, `item_purchased` by `item_type`, `chest_opened` vs. `chest_skipped`, `achievement_unlocked` volume |

All dashboards are scoped to production data only (`deployment_environment = production`) except
Errors and Performance, which intentionally include preview/dev so a broken preview deploy is
visible before it reaches production.
