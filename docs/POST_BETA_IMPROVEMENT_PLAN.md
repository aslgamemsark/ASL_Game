# QuickSign — Post-Beta Improvement Plan

How we turn beta signal into the next build. This is a **prioritization framework**, not a fixed
backlog — the whole point of the beta is to let real data reorder our guesses. It names the data we
now collect, the baseline the beta starts from, and the decision rules for what gets worked on first.

## Where the signal comes from

Everything below is already wired and collecting (see the beta admin dashboard: Admin Panel → Beta):

| Source | What it tells us | Where |
|---|---|---|
| `admin_beta_metrics()` RPC | DAU/WAU, attempt volume, pass rate, rule-reject rate, AI-veto rate, avg confidence, NO_SIGN count, hardest signs | Admin → Beta |
| `feedback` table | Bug reports, feature ideas, general notes (+ page & browser auto-captured) | Admin → Beta inbox |
| `sign_attempts` | Per-attempt pass/fail, rule vs. AI outcome, confidence | aggregated by the RPC |
| `training_samples` | Landmark recordings from opted-in users (never video) for the next model | ML pipeline |
| `sign_verification_log` | Per-parameter scores + classifier vote for failed/close calls | debugging hardest signs |

## Baseline at beta start (measured 2026-07-15, pre-cohort)

These come from the ~457 real attempts already logged, and are the numbers the beta must improve on:

- **Overall pass rate: ~53%.** Expected to be low — includes early fumbling and deliberately-hard
  signs. Watch how it moves as testers learn.
- **Rule-reject rate: ~13%** (of attempts with a rule outcome).
- **AI-veto rate: ~34%** (of attempts the classifier voted on). High — the veto layer is aggressive.
  A big question for the beta is whether it's vetoing *correct* signs (hurting learners) or genuinely
  catching junk.
- **Avg AI confidence: ~0.71.**
- **Hardest signs so far** (by failure count, ≥5 attempts): **YOU, HELLO, MEDICINE**. These are the
  first candidates for recalibration — but only once we have cohort-scale data, not 50 attempts.

## Prioritization rules

Work is ranked by this order, highest first:

1. **Crashes & blockers.** Anything that white-screens, loses progress, or stops a tester from
   playing. These jump the queue regardless of frequency — a blocker with no telemetry is worse than
   a frequent annoyance. (Reminder: production crash reporting is *not* wired yet — this is the top
   infra gap; see `docs/KNOWN_LIMITATIONS.md`.)
2. **Recognition defects with volume.** A sign is a fix candidate when, at cohort scale (**≥30
   attempts from ≥5 distinct users**), it shows either a fail rate >60% *or* an AI-veto rate that
   dwarfs its rule-reject rate (the classifier overriding correct signs). Small-sample outliers wait.
3. **Feedback themes.** Cluster the feedback inbox by category and recurring subject. Three
   independent testers hitting the same wall outranks one very detailed report of a one-off.
4. **Drop-off.** If DAU decays fast after first session, that's a retention/onboarding problem that
   outranks polish — dig into *where* in the funnel via the attempt timestamps.
5. **Polish & requests.** Feature ideas and nice-to-haves, ranked by how many testers asked and how
   cheap they are.

## Likely workstreams (to be confirmed by data)

Not commitments — hypotheses the beta will confirm or kill:

- **Recognition recalibration.** For each qualifying hard sign, pull its `sign_verification_log`
  param scores, find which parameter is the wall, and adjust *that* threshold — never a blanket bump
  (we've regressed a real fixture doing that before; see `docs/CALIBRATION_LOG.md`). Every change
  ships with its confusor test.
- **AI-veto tuning.** If the veto is rejecting correct signs, raise its confidence bar or narrow the
  signs it's allowed to veto. It's veto-only by design; making it *less* aggressive is cheap and safe.
- **Next model version.** Feed the beta's opted-in `training_samples` — especially the hard signs,
  low-confidence cases, and diverse cameras/lighting/left-handed signers — into a retrain. Prioritize
  the examples the current model gets wrong. (Sample quality scoring and richer capture metadata —
  device, FPS, model version — are a documented gap; spec them if the retrain needs them.)
- **Crash observability.** Wire the already-scaffolded error reporting (`web/src/lib/errorReporting.ts`
  is Sentry-ready but not connected) so the *next* beta round isn't blind to crashes.
- **Room-mode disconnect handling.** Port Duel's reconnect/forfeit to Rooms if multiplayer testing
  shows people actually play 3–4 player rooms.
- **Platform coverage.** Fix whatever iOS Safari / firewall issues the cohort surfaces — the two
  least-tested paths going in.

## Exit criteria for the beta

We're ready to plan a wider launch when, on cohort-scale data:

- No open crash-class blockers.
- Overall pass rate is trending up within a session (learners are actually improving, not fighting the
  engine).
- No sign is a persistent >60% failure wall except the ones we've knowingly accepted.
- Feedback volume on any single defect has dropped after its fix shipped.
- The privacy/legal posture for a minor-facing camera app is signed off (a human blocker, unchanged
  from `docs/FINAL_PRODUCTION_SIGNOFF.md`).
