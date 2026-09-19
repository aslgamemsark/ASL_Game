# Analytics coverage and limits

_Code inspection: 2026-09-19. “Instrumented” means a real call site exists in this working tree;
it does not establish production deployment, successful ingestion or complete population coverage._
The [original July implementation report](COVERAGE_2026-07-20.md) is preserved as history.

| Area | Current coverage | Remaining limit |
|---|---|---|
| Acquisition | Shared marketing/app first/latest attribution and explicit tester marker | Device/storage scoped; unknown historical traffic stays outside clean external-production metrics |
| Identity | Auth callback synchronization, ordered SDK-readiness queue, account-switch/reset handling | No cross-device guest identity; blocked/disabled analytics undercounts |
| Auth | Email request start/submission; Google intent; observed sign-in | No authoritative confirmed-new-account event |
| Activation | v3 first accepted sign, including onboarding and all attempt-reporting surfaces | Device-local guest/account dedup; SDK acceptance is not server receipt; compare versions separately |
| Camera | Requested → first frame correlation, permissions/errors/stalls, MediaPipe init outcomes | Events may be absent on abrupt tab loss; permission success alone is not a usable feed |
| Recognition | Started/ended runs plus existing rule-pass decisions | Runs are not physical attempts; neither source supplies ground-truth ASL accuracy |
| Demo clips | Missing/load error and observed playback | Does not measure completeness, attention or correct ASL instruction |
| Lessons/practice/story/speed | Start/completion and mode-specific result fields | Completion can include skips; repeated sessions need careful correlation |
| Multiplayer | Room/match lifecycle and ICE outcomes | Check event call sites for each mode before assuming reconnection coverage is identical |
| Economy, friends, feedback | Action events at existing mutation/reporting paths | Virtual rewards are not revenue; feedback category events deliberately overlap |
| Reliability | Render-boundary, window/rejection and instrumented functional errors | A client error is not necessarily a crash; not every network error is covered |
| Diagnostics | Replay with masked inputs, autocapture, Web Vitals | Project settings/consent/blocking affect availability; not proof that all visible text is private |

The optional classifier remains disabled for both loading and veto enforcement. Historical ML
confidence/veto charts are not the current recognition funnel. Existing feature flags are declared
in `featureFlags.ts`; verify a real reader before claiming a flag controls a feature. Remote assets
and their definitions must be checked separately; see [dashboard links](DASHBOARD_GUIDE.md).

## Before trusting a release's numbers

Confirm the reviewed `git_commit` is deployed, then inspect actual events for their version,
identity transitions, sanitized fields and expected ordering. Keep internal/preview verification
separate from canonical-host external production. Compare old and new instrumentation as different
cohorts; never turn absence before release into a zero-failure result.

Use [Funnels](FUNNELS.md) for valid denominators. Qualified-signer review, real-device checks and
source-license review remain separate requirements; analytics cannot substitute for them.
