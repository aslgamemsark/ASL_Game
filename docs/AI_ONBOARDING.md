# QuickSign — current project brief

_Last reconciled with the repository: 2026-09-19. Read [AGENTS.md](../AGENTS.md) first._

This is the only general onboarding/current-state summary. Use the task map below instead of
reading every handoff. Dated audits preserve evidence; source code and fresh deployment checks
settle current behavior. Do not assume local changes have shipped.

## Product and runtime

QuickSign teaches/practices ASL through lessons, practice and scenarios with camera feedback.
The React 19 / TypeScript / Vite application in `web/` is the production runtime, hosted at
**https://quicksignn.vercel.app**. `aslgame.vercel.app` was removed at the owner's request;
do not recreate it or describe it as the canonical address.
Rechecked 2026-09-22: Vercel lists only the canonical domain and a fresh HTTP request to the old
domain returns `404 DEPLOYMENT_NOT_FOUND`. A browser with the old PWA cached can still show its
app shell; that is not evidence of an active deployment.

Recognition is local: MediaPipe Tasks → landmark history → per-parameter rule verifier →
lesson feedback. Definitions live in `web/src/engine/signs/index.ts`; descriptions and demo
clip paths live separately in `web/src/data/signs.ts`. Keep their instructions consistent.
Python under `core/`, `signs/`, `scenarios/` and `ml/` supports offline tooling and training;
it is not what executes in a learner's browser.

The classifier is **disabled**, both loading and veto enforcement, by
`web/src/config/classifier.ts`. The implementation remains available for validated future
experiments; it is never allowed to rescue a rule failure. Do not infer live inference merely
from the presence of model files or historical ML documentation.

The learner-facing registry has **51 signs** (26 letters, 25 words). The engine also contains
four World Cup definitions; registry size alone is not a count of taught content. Derive counts
from the registries when changing content rather than repeating dated handoff numbers.

Supabase provides auth, progress and multiplayer signaling. Multiplayer video is WebRTC between
participants; optional training-data collection has separate privacy/consent requirements.
Do not turn “recognition is local” into a blanket claim that no app feature transmits data.
PostHog uses the typed analytics wrapper; verify current replay/autocapture settings in
`web/src/analytics/client.ts` instead of copying the old “both disabled” statement.

## Current priorities and boundaries

- First-use reliability and trustworthy analytics: camera/model recovery, onboarding success,
  lesson completion, identity and attribution. Check the current diff/release before claiming a
  fix is deployed. Existing analytics history is not retroactively repaired by a code change.
- ASL teaching quality is the main content weakness. Prioritize a smaller set of accurate,
  qualified-signer-reviewed demonstrations over a larger clip library. The replacement source
  decision is deferred; no licensing partnership or revenue share has been agreed.
- A passing synthetic fixture or avatar geometry test does not validate ASL fluency, natural
  motion or accuracy for beginners. Real-signer review and real-device camera checks remain
  separate from automated regression tests.
- Do not revive the rejected raw-video retargeting pilot as an approved animation plan.
  Preserve the mandatory authoring and movement rules in AGENTS.md.

## Open only what the task needs

| Task | Starting points |
|---|---|
| Run/test the web app | [web/README](../web/README.md); `web/package.json` |
| App structure / data flow | [Architecture](../ARCHITECTURE.md) |
| Recognition, calibration, new signs | `web/src/engine/`, `web/src/hooks/useRecognition.ts`; installed `new-sign` skill; [calibration log](CALIBRATION_LOG.md) |
| Content accuracy / replacement rights | [ASL validation](ASL_VALIDATION_PROGRAM.md), [licensing](LICENSING_CHECKLIST.md) |
| Analytics implementation | [Developer guide](analytics/DEVELOPER_GUIDE.md); `web/src/analytics/` |
| Deployments / rollback | [Deployment](../DEPLOYMENT.md); [launch checks](LAUNCH_CHECKLIST.md) |
| Multiplayer | [Runbook](MULTIPLAYER_RUNBOOK.md), [test setup](MULTIPLAYER_TESTING.md) |
| Avatar animation (deferred) | [Authoring guardrails](AVATAR_AUTHORING_HANDOFF.md), [retargeting findings](VIDEO_RETARGET_HANDOFF.md), [avatar architecture](ARCHITECTURE.md) |
| Python / model training | [Python tools](PYTHON_PROTOTYPE.md), [ML README](../ml/README.md) |
| Design / product goals | [Design](../DESIGN.md), [Product](../PRODUCT.md), [operating rules](OPERATING_RULES.md) |
| Why an old decision was made | [History index](vault/00-Index.md), [archive](archive/README.md); search [WORKLOG](WORKLOG.md) by topic/date |

## Release discipline

`main` is the production branch for the canonical Vercel project `asl-game`; a push can deploy.
Review the actual diff and run relevant tests before pushing. Avoid promoting a different
branch's deployment over `main`. Use `npm run build` (`tsc -b` + Vite), not `tsc --noEmit` alone.
See DEPLOYMENT.md for topology, environment and rollback detail. Never copy secrets into docs.
