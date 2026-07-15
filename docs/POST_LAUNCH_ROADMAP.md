# QuickSign — Post-Launch Roadmap

Sequenced by value-to-effort, assuming the two launch blockers (error monitoring, privacy/legal) are
resolved first per `LAUNCH_CHECKLIST.md`.

## Milestone 1 — Stabilize (first 2 weeks post-launch)
- **Error monitoring live + triage loop.** Watch real crashes; fix the top few. (This is where the
  "flying blind" risk gets retired.)
- **DB hardening migration** (showcase_badges guard, speed_high_scores bounds, region CHECK,
  admin_set_username audit parity, migration replay reorder). One small migration, low risk.
- **Room-mode disconnect/forfeit** — port duel's `bye`/roster-prune so rooms don't stall.
- **Cross-browser + real-device verification**, prioritizing iOS Safari camera/WebRTC.
- **CI gate** (vitest + tsc on every PR) if not already present; rollback runbook.

## Milestone 2 — Recognition quality (weeks 3–8)
- **Real-user training loop.** The consent-gated pipeline exists; start periodic retrains as data
  accumulates. Track cross-dataset holdout each run (already wired) so you can prove generalization is
  improving, not just test accuracy.
- **Calibrate RED, WANT** and re-record the 6 stale fixtures.
- **Revisit HELP/DOCTOR ceilings** once the ML layer has enough real data for those classes to
  contribute meaningfully.
- **Consider active learning**: prioritize labeling the failed/near-miss attempts already logged
  (highest-value negatives), per `docs/REAL_WORLD_DATA_COLLECTION_REVIEW.md`.

## Milestone 3 — Accessibility & polish (weeks 4–10, parallelizable)
- **Full WCAG pass**: keyboard nav, focus management, ARIA, `prefers-reduced-motion`, contrast,
  touch-target sizing. Add automated a11y tests (axe) to CI.
- **The eslint-disable-exhaustive-deps cleanup** (C3) — a dedicated pass to retire the ~20 suppressions,
  especially in camera/multiplayer lifecycle code where stale closures bite hardest.
- **Per-screen UX audit** at multiple breakpoints (mobile/tablet/desktop/large monitor), loading/empty/
  error/offline states.

## Milestone 4 — Growth features (post product-market-fit signal)
- **Matchmaking** for multiplayer (random opponents), if multiplayer proves popular.
- **TURN scaling** decision if WebRTC failures show up in monitoring.
- **E2E test suite** for the multiplayer flows (P2P is hard to test but high-value to cover).
- **Analytics-driven retention work**: identify boring/frustrating moments from real funnels rather
  than guesses.

## Milestone 5 — Avatar (only if it becomes a user-facing feature)
- Full review of the `/avatarlab` system before shipping to users (currently dev-only): animation
  system, expressions, Mixamo/VRM compatibility, asset compression (Draco/texture), finger/palm-roll
  solving (M6+).

## Scalability watch points (revisit at each 10× user growth)
- **Leaderboard `weekly_leaderboard` view** — profile once it's over ~10k rows; add indexes/materialization
  if it slows.
- **WebRTC signaling on Supabase Realtime** — fine at small scale; watch channel/connection limits.
- **On-device inference scales for free** (no server cost per recognition) — this is a genuine
  architectural strength as users grow.
