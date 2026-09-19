# PostHog dashboards

Use existing dashboards in QuickSign project **518794**. Links identify existing assets; their
presence does not verify current tile definitions, newly deployed events or fresh ingestion.
Apply [the measurement definitions](FUNNELS.md) when reviewing or updating a tile.

| Dashboard | Existing link | Purpose |
|---|---|---|
| Growth / Launch | [2067585](https://us.posthog.com/project/518794/dashboard/2067585) | Acquisition, activation and retention |
| Executive / Activation | [1873040](https://us.posthog.com/project/518794/dashboard/1873040) | First learning value and lesson progression |
| Recognition | [1874393](https://us.posthog.com/project/518794/dashboard/1874393) | Camera readiness, run outcomes and clip failures |
| Errors | [1874390](https://us.posthog.com/project/518794/dashboard/1874390) | Fatal render errors, client errors and functional failures |

Start with a small useful set of tiles:

- External production entrants → v3 first-sign success, without requiring lesson completion first.
- First-success cohort returning to learning the next calendar day; show eligible cohort size.
- Camera request → first frame by request id, MediaPipe ready/error outcomes, unmatched recognition
  starts and ended-run outcomes by sign. Label these as operational outcomes, not ASL accuracy.
- Ordered lesson completion with correct/skipped counts, plus reference-clip missing/load errors.
- `fatal_error`, `client_error`, `unexpected_reload` and `error_captured` separately, by release/browser.

Keep preview/internal diagnostic views separate from the external production population. Do not
mix them into growth conversion. Hide or relabel old signup/crash/accuracy tiles when their event
meaning has changed. An event with no samples is not proof that its feature is unused or healthy.
Only add another dashboard when an actual decision needs it; avoid rebuilding the former eight-
or twelve-dashboard wish list.

## Changes saved on 2026-09-19

Nine existing insights were corrected: four activation/lesson funnels, two rule-pass decision
charts, two error charts, and camera/runtime reliability. Four dashboards now explicitly filter
to `$host = quicksignn.vercel.app` and `traffic_type = external`; unknown historical traffic is
excluded. Customer Analytics activity now uses `screen_viewed`, not the disabled `$pageview`.

Added [camera startup](https://us.posthog.com/project/518794/insights/GaB2Zvwy) and
[recognition run outcomes](https://us.posthog.com/project/518794/insights/VD6pNvTf). Both are marked
pending application deployment. The saved camera chart is a one-day person funnel, not an exact
request-id join. The saved lesson funnel is person-level and does not match individual lesson
instances. New telemetry and v3 first-success semantics are not yet a trustworthy production
baseline; verify the deployed commit and actual ingestion first. Historical events were retained.
