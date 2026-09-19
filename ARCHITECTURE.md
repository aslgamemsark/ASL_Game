# QuickSign architecture

This describes the shipped web app. Start with [the project brief](docs/AI_ONBOARDING.md)
for current priorities and [AGENTS.md](AGENTS.md) for binding recognition rules.
The old speculative refactoring proposal is [archived](docs/archive/architecture-2026-07-25.md).

## Boundaries

| Location | Responsibility |
|---|---|
| `web/src/App.tsx`, `pages/`, `components/` | Browser navigation, learning screens and shared UI |
| `web/src/hooks/useCamera.ts` | Camera permission, stream lifecycle and recovery |
| `web/src/hooks/useRecognition.ts` | Capture lifecycle, rolling history, verification and attempt/pass callbacks |
| `web/src/engine/` | MediaPipe capture, schema, landmark geometry and generic sign verification |
| `web/src/engine/signs/index.ts` | Recognition requirements expressed as data |
| `web/src/data/` | Lesson/world/story content, display instructions and clip paths |
| `web/src/stores/`, `hooks/useProgressSync.ts` | Local learning state and Supabase progress synchronization |
| `web/src/contexts/AuthContext.tsx` | Supabase auth lifecycle |
| `web/src/analytics/`, `hooks/useAttemptLog.ts` | Typed PostHog tracking and shared attempt reporting |
| `supabase/migrations/` | Database schema evolution, permissions and server-side constraints |
| `core/`, `signs/`, `scenarios/`, `ml/`, `tools/` | Python prototype, training and offline calibration tools |
| `web/src/avatar/` | Separate avatar authoring/research subsystem; [guardrails](docs/AVATAR_AUTHORING_HANDOFF.md) |

## Recognition flow

Camera frames → MediaPipe hand/pose landmarks → normalized landmark history → generic verifier
→ per-parameter feedback → learning flow. Required parameters must each pass; movement is
measured over time. Shared recognition stays in the engine, never in a scenario-specific fork.

The optional classifier path can veto a rule pass but cannot grant one. Loading and enforcement
are both off in `web/src/config/classifier.ts`; the presence of that code does not mean the
classifier runs today. Its validation criteria must be met before re-enabling it.

`engine/signs/index.ts` and `data/signs.ts` serve different consumers. Changes to a sign must
preserve agreement between what the learner is told to perform and what the engine checks.
Python and TypeScript do not share a runtime. Maintain the relevant offline behavior when
changing shared recognition concepts, but fix browser failures in the browser implementation.

## Data and privacy

Recognition itself requires no remote inference service. Supabase provides auth, progress,
leaderboards and multiplayer signaling. WebRTC carries multiplayer media to participants;
training-data collection is a separate consent-controlled path. Analytics payloads must contain
neither video nor landmark arrays. Use the centralized tracking API and existing privacy guards.

## Verification

Run commands in `web/`: `npm run test` for unit regressions, `npm run build` for TypeScript and
production bundling, `npm run test:e2e` for production browser flows, and
`npm run test:first-learning` for controlled camera/model recovery and completion regressions.
Multiplayer has its [own local Supabase test setup](docs/MULTIPLAYER_TESTING.md).
Python engine changes require the relevant pytest suite. Browser simulations and synthetic
fixtures do not replace real-device or qualified-signer validation.

Keep modules at their existing boundaries unless a demonstrated bug or repeated dependency
requires a change. The archived proposal is not a mandate for service interfaces, domain stores
or a wholesale directory migration.
