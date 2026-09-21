# QuickSign — Launch Checklist

Manual/human release checks, originating in the July 15 audit. Unchecked items remain unverified
until fresh evidence establishes their status; this cleanup does not waive them. Code-side
findings are in [the historical sign-off](archive/FINAL_PRODUCTION_SIGNOFF.md).

## September 21 reconciliation — implementation is not a production sign-off

- [x] Error events are wired through `web/src/lib/errorReporting.ts` to PostHog (`fatal_error`,
      `client_error`, `unexpected_reload`). Raw error text is excluded and reports are bounded.
      A separate Sentry account is not required for this implementation.
- [x] Basic analytics exists in `web/src/analytics/`; the September audit updates identity,
      attribution and learning/camera events. See [the analytics guide](analytics/DEVELOPER_GUIDE.md).
- [x] PR CI exists in `.github/workflows/ci.yml`: lint, unit tests, `npm run build` (`tsc -b`),
      Python, browser and disposable-Supabase multiplayer jobs. This does not itself establish
      branch-protection settings or prevent Vercel deploying a push to `main`.
- [x] Fresh database migration replay and 24 room-registry checks passed in CI for `8cdb910`.
      Web/Python and general browser checks passed (121 browser passes, five skips), but the
      multiplayer suite has six browser failures (26 passes total). Release remains blocked;
      failure diagnostics now capture both browser clients for investigation.
- [x] Room host-disconnect handling is implemented in the release branch: a guest exits after
      30 seconds of host absence; duplicate completion/reward handling is guarded. Deployment
      and physical-device verification remain pending. See [the multiplayer runbook](MULTIPLAYER_RUNBOOK.md).
- [x] A manual rollback runbook exists in [DEPLOYMENT.md](../DEPLOYMENT.md#rollback).
- [x] The production training-sample trimming cron was verified active (every 15 minutes).

The live target is `juzqilqilxzmudazltjx` (ARKhan8604's Project, QuickSign organization), verified
against the public app bundle. September 21 advisors still report 12 authenticated
SECURITY DEFINER warnings (nine guarded admin functions and three room functions), disabled
leaked-password protection, and one informational no-policy finding for private
`room_join_attempts`. Performance baseline: 24 `auth_rls_initplan` and 15 unused-index findings.
These are recorded findings, not a claim that production hardening is complete.

## 🔴 Blockers (do before public launch)

- [ ] **Verify the released PostHog events arrive correctly**, including error, camera and learning
      events, with consent/opt-out respected. Implementation and updated dashboards do not prove
      the new production build is sending them.
- [ ] **Confirm previously exposed credentials were revoked/rotated** and dependent services
      still work. The owner is unsure; a list of current masked keys cannot prove old-key revocation.
- [ ] **Complete real-phone signing and physical two-device multiplayer checks.** Browser
      emulation and fake media do not establish camera recognition or mobile WebRTC reliability.
- [ ] **Privacy policy + legal review for a camera app that may attract minors.** Covers COPPA
      (US <13) and GDPR (EU, incl. minors). Needs: a published privacy policy, an age-appropriate
      consent model, documented data retention + deletion path. (legal/human — cannot be coded away)
- [ ] **Decide the `collectTrainingData` default** for the target audience. Currently defaults **on**
      in the store; first sign-in on each device also prompts for an explicit choice in
      `AuthContext`. Review the complete collection/consent flow with product + legal; the prompt
      alone is not evidence that every collection path is appropriately gated.
- [ ] **Verify the intended production release actually shipped.** Confirm the canonical Vercel
      project built the reviewed `main` commit successfully and serves it at
      `https://quicksignn.vercel.app`. Clear/reload any stale service worker and verify the affected
      user flow. A successful Git push is not evidence of a successful deployment. The old July 15
      commit/domain example is historical and must not be used as today's target.
- [ ] **Confirm a data-deletion path exists** for account deletion (GDPR "right to erasure"): deleting
      the auth user should cascade/clear `profiles`, `user_progress`, `training_samples`, `sign_attempts`.
      Verify the FK `on delete` behavior actually removes personal data.

## 🟡 Strongly recommended (first week)

- [ ] **Apply the low-severity DB hardening** (see S2–S6 in the sign-off): showcase_badges guard,
      speed_high_scores bounds, region CHECK, admin_set_username audit-log parity. Ship as one small
      migration. (~half day)
- [ ] **Deploy and verify the reviewed multiplayer migration and client together**, after release
      checks pass. Disposable-DB replay success is not evidence that the hosted DB was updated.
- [ ] **Calibrate RED and WANT** (A2): record correct+confusor takes via `/calibrate`, tune from the
      logs (method in `docs/CALIBRATION_LOG.md`).
- [ ] **Cross-browser smoke test**: Chrome, Safari (esp. iOS — camera + WebRTC quirks), Firefox, Edge.
      MediaPipe/WASM + getUserMedia behave differently across these.
- [ ] **Mobile device test**: real iOS + Android, camera permission flow, touch targets, WebRTC over
      cellular.

## 🟢 Nice to have (pre- or post-launch)

- [ ] Re-record the 6 stale `_real.json` calibration fixtures (A4).
- [ ] A11y pass: keyboard nav, focus order, ARIA labels, `prefers-reduced-motion`, contrast, touch
      target sizes (see roadmap).
- [ ] Load-test the leaderboard `weekly_leaderboard` view at 10k+ rows.
- [ ] Confirm TURN server capacity/cost if multiplayer usage grows (currently OpenRelay free tier).

## Credentials / accounts needed from a human
- Confirmation of credential rotation/revocation and real-device test results.
- Legal/privacy-policy content (or a service to generate one).
- If scaling TURN: a paid TURN provider account.
