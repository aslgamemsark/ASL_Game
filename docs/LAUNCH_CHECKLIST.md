# QuickSign — Launch Checklist

Manual/human tasks remaining before a public launch. Grouped by whether they block launch. Code-side
findings are in `FINAL_PRODUCTION_SIGNOFF.md`; this file is the "things a person must do" list.

## 🔴 Blockers (do before public launch)

- [ ] **Wire production error/crash monitoring** (Sentry or equivalent). `web/src/lib/errorReporting.ts`
      is structured to accept it. Without this you have zero visibility into real user crashes. (~half day, engineering)
- [ ] **Privacy policy + legal review for a camera app that may attract minors.** Covers COPPA
      (US <13) and GDPR (EU, incl. minors). Needs: a published privacy policy, an age-appropriate
      consent model, documented data retention + deletion path. (legal/human — cannot be coded away)
- [ ] **Decide the `collectTrainingData` default** for the target audience. Currently defaults **on**
      (opt-out). For a kid-facing app, opt-in may be required. Product + legal decision.
- [ ] **Verify the production deploy succeeded** after the `main` merge this session (the multiplayer/
      borders/streak/moderation features were merged to `main` today). Confirm `aslgame.vercel.app`
      builds and the Multiplayer tab now appears. (Vercel dashboard)
- [ ] **Confirm a data-deletion path exists** for account deletion (GDPR "right to erasure"): deleting
      the auth user should cascade/clear `profiles`, `user_progress`, `training_samples`, `sign_attempts`.
      Verify the FK `on delete` behavior actually removes personal data.

## 🟡 Strongly recommended (first week)

- [ ] **Apply the low-severity DB hardening** (see S2–S6 in the sign-off): showcase_badges guard,
      speed_high_scores bounds, region CHECK, admin_set_username audit-log parity. Ship as one small
      migration. (~half day)
- [ ] **Fix the migration replay ordering bug** (S6) so `migrations/` can stand up a fresh DB — needed
      for staging parity and disaster recovery.
- [ ] **Add Room-mode disconnect/forfeit handling** (M2) — port the duel `bye`/roster-prune pattern.
- [ ] **Calibrate RED and WANT** (A2): record correct+confusor takes via `/calibrate`, tune from the
      logs (method in `docs/CALIBRATION_LOG.md`).
- [ ] **Set up a CI gate** that runs `npx vitest run` + `tsc --noEmit` on every PR (GitHub Actions).
      Confirm one doesn't already exist; if not, add it so a red test can't merge.
- [ ] **Define a rollback runbook** (how to revert a bad Vercel deploy + how to roll back a Supabase
      migration).
- [ ] **Cross-browser smoke test**: Chrome, Safari (esp. iOS — camera + WebRTC quirks), Firefox, Edge.
      MediaPipe/WASM + getUserMedia behave differently across these.
- [ ] **Mobile device test**: real iOS + Android, camera permission flow, touch targets, WebRTC over
      cellular.

## 🟢 Nice to have (pre- or post-launch)

- [ ] Re-record the 6 stale `_real.json` calibration fixtures (A4).
- [ ] Basic analytics (privacy-respecting) to understand funnel/retention.
- [ ] A11y pass: keyboard nav, focus order, ARIA labels, `prefers-reduced-motion`, contrast, touch
      target sizes (see roadmap).
- [ ] Load-test the leaderboard `weekly_leaderboard` view at 10k+ rows.
- [ ] Confirm TURN server capacity/cost if multiplayer usage grows (currently OpenRelay free tier).

## Credentials / accounts needed from a human
- Sentry (or chosen monitoring) project + DSN.
- Any analytics provider account.
- Legal/privacy-policy content (or a service to generate one).
- If scaling TURN: a paid TURN provider account.
