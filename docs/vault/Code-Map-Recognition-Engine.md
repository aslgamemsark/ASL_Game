---
type: moc
---

# Code Map — Recognition Engine

The pipeline that turns a webcam frame into a pass/fail + live coaching. Exists **twice** —
Python (source of truth) and TypeScript (browser mirror) — see [[Architecture#Dual-engine parity]].

## Python (`core/`)
- `core/capture.py` — MediaPipe Tasks API wrapper (Hand + Pose + optional Face Landmarker).
- `core/landmarks.py` — `Frame` / `Hand` dataclasses, `RollingBuffer` (the ~1.5-2s window every
  movement check reads), `HandStabilizer` (bridges brief detection dropouts in live play).
- `core/handshape.py`, `core/movement.py`, `core/orientation.py` — one scorer per parameter kind.
- `core/verifier.py` — `verify(buffer, sign) -> VerifyResult`. The one function everything calls;
  reads a [[Code-Map-Signs-Data|Sign]] + the rolling buffer, returns a `ParamScore` per parameter.
  Also does DOMINANT/NONDOMINANT role assignment by relative motion (`assign_roles`).
- `core/schema.py` — the `Sign`/`HandShapeReq`/`LocationReq`/`MovementReq`/`OrientationReq`/`NmmReq`
  dataclasses signs are built from.

## TypeScript (`web/src/engine/`)
Same shape, same names, camelCase: `capture.ts`, `landmarks.ts`, `handshape.ts`, `movement.ts`,
`orientation.ts`, `verifier.ts` (`verify()`), `schema.ts` (`createSign()` factory with defaults).

## The disambiguation layer (veto-only)
- `web/src/engine/classifier.ts` — loads the trained Bi-GRU (`web/public/models/signs/`, TF.js),
  runs inference once per rule-pass (not every frame).
- `web/src/engine/gate.ts` — `gatePass()` / `gateHint()`: the classifier can only **veto** a
  rule-pass (confidently disagree) or add a hint; it can never turn a rule-fail into a pass. See
  [[Decisions-Log]] and [[ML-Pipeline]] for why this boundary is load-bearing, not incidental —
  and [[Code-Map-Signs-Data]] for the three sign pairs (COFFEE/YES, DOCTOR/NURSE, MEDICINE/DOCTOR)
  where this veto is the *only* thing distinguishing them, confirmed from real data 2026-07-06.

## Live coaching (confidence-gated, added 2026-07-06)
- `web/src/engine/coachingGate.ts` — `advanceGateState()`: per-parameter score has to be clearly
  and *sustainedly* below threshold before a specific corrective tip shows; otherwise a neutral
  "keep trying" state. Prevents fast-but-wrong tips from single noisy frames.
- `web/src/components/lesson/ParameterChecklist.tsx` — renders that gate state live, per
  parameter, with plain-language hints (`hintFor()`).

## Where this gets called from
`web/src/hooks/useRecognition.ts` is the seam between this engine and the app — see
[[Code-Map-Web-App]] for `PracticePage`/`LessonPage`, which own the actual camera UI, replay
recording, and result screens.
