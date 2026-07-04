# Avatar Engine — Project Status

_Last updated: 2026-07-01_

## Current milestone: Milestone 5 — Arm Retargeting (in progress, gated)

Per the approved build-order plan, Milestones 1-4 were demonstrated as one batch and approved.
Milestone 5 onward requires explicit go-ahead per milestone before starting the next.

## Completed

- **Milestone 1 — Skeleton Discovery**: name-agnostic bone discovery on `ybot.glb` (65 bones, full
  arm/finger/spine chains, world positions via FK). `web/src/avatar/calibration/SkeletonInspector.ts`.
- **Milestone 2 — Calibration Engine**: per-bone rest directions/lengths, palm-normal references,
  round-trip FK validation (0.000000mm across all 65 bones). `CalibrationEngine.ts` +
  `CalibrationValidator.ts`.
- **Milestone 3 — Landmark Loader**: adapted to the REAL ASL Citizen + WLASL dataset schema (2D pose,
  no elbow, null-pose frames handled explicitly). `retarget/LandmarkLoader.ts`.
- **Milestone 4 — AvatarLab viewers**: Skeleton + Landmark viewers, demonstrated and approved.
- **Milestone 5 — Arm Retargeting** (in progress):
  - Hand-authored body-frame paths for the 3 benchmark signs (COFFEE, THANK_YOU, HELLO), ported from
    the one procedural-avatar approach that reliably worked historically.
  - Analytical 2-bone IK + calibration-anchored aim quaternions.
  - **Root-cause bug found and fixed**: arm/forearm segment lengths were read from
    `CalibrationProfile.restChildLengths`, which is local-space/pre-armature-scale (documented as
    such) — on this Mixamo rig that's ~100x too large, flinging the solved elbow ~26m from the
    shoulder while the wrist still landed exactly on target (the wrist-position formula is a
    self-consistent identity that can't detect a bad elbow — this is *why* the acceptance metric read
    0.00mm/PASS while the rendered arms visibly crossed through the torso). Fixed to read real
    world-space rest lengths from `hierarchy.bones[...].worldPosition` instead. 5 new regression
    tests pin this exact failure mode (elbow-to-shoulder distance, torso-crossing check) — proved to
    actually fail against the old code before being merged.
  - **Reference Pose System** (permanent subsystem, not scoped to M5) built in response to this bug:
    lets a human pose the avatar correctly in Blender once, and numerically regress the solver
    against it forever after. See `docs/REFERENCE_POSE_SPEC.md`.
  - **13 geometric sanity tests** (`armPoseSanity.test.ts`) pin the specific visual criteria checked
    for HELLO/THANK_YOU/COFFEE: no torso penetration, no elbow inversion, no upper-arm overlap,
    wrist-target accuracy, and shoulder immobility — all passing.
  - **AnimationSource** (permanent subsystem): human-posed Blender keyframes can now DRIVE the
    animation, not just verify it. Give a sign 2+ reference poses at different `frameFraction`s and
    `resolveAnimationForSign` automatically prefers SLERP-interpolating between them
    (`KeyframeAnimator`) over the guessed procedural IK path — an ordered priority chain
    (`docs/ARCHITECTURE.md`), extensible to a future MotionCapture source without touching the first
    two. This exists because the procedural path's arm targets are still my own guessed offsets, not
    informed by someone who knows the signs — real Blender keyframes are strictly better ground
    truth once they exist.

## Not yet built

- **Milestone 6 — Finger Solver**: palm plane (wrist/index-MCP/pinky-MCP) → per-finger direction
  vectors → joint angles → calibrated quaternion. Currently `RightHand`/`LeftHand` bones stay at rest
  rotation — the Reference Pose System's comparator already reports these as `unsolved` (not a false
  pass) for exactly this reason.
- **Milestone 7 — Animation Baking**: combine arm path + finger solve into a smoothed `AnimationClip`.
- **Milestone 8 — Verification Engine**: numeric comparison against the real landmark dataset (not
  just Reference Poses — the landmark data is real multi-signer footage, a different ground truth
  than a single hand-posed Blender snapshot).
- **Milestone 9 — Export**: GLB/clip export, scale from 3 benchmark signs to all 18
  dataset-overlapping signs.

## What's next

1. Create the first real Reference Pose (HELLO, per `docs/BLENDER_WORKFLOW.md`) to validate the
   system end-to-end with real ground truth, not just the empty-state tests.
2. Re-verify Milestone 5 visually in `/avatarlab` (Retarget tab + new Reference Pose tab) now that
   the root-cause fix is in.
3. Demo Milestone 5 (with the Reference Pose System) and get explicit go-ahead before starting
   Milestone 6, per the established gating cadence.

## Key files if you're picking this up cold

- Plan / build order: see the approved plan doc (Avatar Engine v2 — Spec-Driven Rebuild).
- Architecture: `docs/ARCHITECTURE.md`.
- Reference Pose System spec + how to add a pose: `docs/REFERENCE_POSE_SPEC.md`,
  `docs/BLENDER_WORKFLOW.md`.
- Dev tool: `/avatarlab` (only in `npm run dev`, gated out of production builds).
