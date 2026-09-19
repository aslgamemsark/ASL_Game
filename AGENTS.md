# QuickSign — instructions for contributors and AI agents

Read this file and [the current project brief](docs/AI_ONBOARDING.md). Then open only the
references relevant to the task. Historical handoffs and work logs are evidence, not a startup checklist.

## Current runtime

- The shipped app is React + TypeScript + Vite in `web/`. Browser recognition lives in
  `web/src/engine/`; Python `core/`, `signs/`, `scenarios/` and `ml/` support offline tools,
  training and reference. A production recognition fix starts in the TypeScript path.
- Recognition runs locally through MediaPipe Tasks and the rule verifier. Supabase handles
  auth, progress and optional training data; it is not a remote recognition service.
- The optional ML layer is veto-only by design. Both loading and enforcement are currently
  disabled in `web/src/config/classifier.ts`. Do not describe it as active or enable it as a
  threshold fix. Re-enabling requires that file's validation criteria.
- Keep shared recognition logic shared. Scenarios own presentation and content, not their own
  copies of the verifier. Engine definitions and displayed instructions are separate registries;
  check both when changing a sign.

## Recognition rules — binding

Every sign has five parameters: **handshape, location, movement, palm orientation and
non-manual markers**. Declare requirements as data in `web/src/engine/signs/index.ts` using
`schema.ts`. Every required parameter must independently clear its threshold; never average
away a failed requirement.

**A sign requiring movement must never pass from one frame.** Analyze a rolling window of
roughly 1.5–2 seconds. The original COFFEE bug approved two static fists because it omitted the
required circular motion. Keep a correct-performance fixture and a confusor that fails on the
right parameter. Synthetic test success does not establish correctness on real human signing.

Use shoulder-width ratios for spatial thresholds, not pixels. Before adding/fixing a sign,
read the installed `new-sign` skill and [calibration log](docs/CALIBRATION_LOG.md). If a
movement sign has no movement specification, resolve that specification before implementing it.

## Assets, datasets and avatar work

- ASL Citizen and WLASL have source-specific terms. The owner authorized WLASL experiments on
  2026-06-30; this is not commercial clearance. Verify terms before commercially releasing a
  model trained on it. Do not use ASLLVD. Preserve consent/provenance for our own recordings.
- Complete [the licensing checklist](docs/LICENSING_CHECKLIST.md) before charging for the app.
  Free viewing or downloading does not imply permission to redistribute a lesson clip.
- **Before changing avatar authoring, finger curls or the animation path, read
  [AVATAR_AUTHORING_HANDOFF](docs/AVATAR_AUTHORING_HANDOFF.md).** Measure the rig; never guess
  axis conventions. Use FK readback before writes. User-authored Blender keyframes outrank
  code-authored pose guesses.
- Read [VIDEO_RETARGET_HANDOFF](docs/VIDEO_RETARGET_HANDOFF.md) before changing that pipeline.
  Its ASL Citizen pilot (HELLO, YOU, COFFEE, WANT, HOSPITAL) was rejected for animation quality;
  it is not an approved active replacement plan. Animation replacement is currently deferred.

## Working rules

- Follow the relevant engineering rules in `.claude/rules/` (the existing rule directory).
  `.Codex/rules/` does not exist; do not search for or invent its former 30-file list.
- Trace a bug's shared path and callers before editing. Reuse existing helpers; avoid speculative
  architecture and bulk rewrites. Preserve other contributors' uncommitted work.
- Delegate well-specified mechanical work when practical; independently inspect the diff and
  run appropriate tests. Do not push or deploy unreviewed changes.
- `npm run build` in `web/` runs the authoritative `tsc -b` check. `tsc --noEmit` alone is
  insufficient for this solution-style configuration. See [web setup](web/README.md) for tests.
- Use the centralized analytics API in `web/src/analytics/`; never send video or landmarks to
  PostHog. Respect DNT and the user's analytics opt-out.
- Keep this file for durable instructions, the project brief for current facts, and specialized
  runbooks for detail. Update the owning document instead of adding another general handoff.
- Public posts/messages require the user's approval of the exact text before submission.
  Follow explicit authorization already given in the current session.
