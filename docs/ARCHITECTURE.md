# Avatar Engine — Architecture

The Avatar Engine lives inside the existing React/TS web app at `web/src/avatar/`, not as a separate
repo or service. It imports nothing from React — the engine is pure data/logic, and
`web/src/avatar/viewer/` is the only layer that touches React/Three.js, consuming the engine the same
way a Node CLI tool does.

## Why this design (recap)

The avatar's **arm/hand position** comes from hand-authored body-frame paths
(`animation/signPaths.ts`, ported from an earlier working procedural pipeline), not from the real
landmark dataset — the dataset has 2D-only, no-elbow pose data, which cannot support 2-bone IK
without inventing information (Appendix A Rule 2). **Handshape/palm orientation** (Milestone 6+) will
be fed by the real multi-signer landmark dataset, where the engine's calibration-based approach adds
real value. See the original build-order plan for the full rationale.

## Module map

```
web/src/avatar/
  calibration/     Milestone 1-2: skeleton discovery + calibration (rig-agnostic, any GLB)
    glbBinary.ts          manual GLB chunk parser (no three.js dependency)
    types.ts               AvatarHierarchy, BoneInfo, CalibrationProfile, etc.
    math3d.ts               dependency-free vector/quaternion/matrix math (used everywhere)
    SkeletonInspector.ts    buildHierarchy() — name-pattern bone discovery + world-position FK
    CalibrationEngine.ts    buildCalibration() — rest-pose directions/lengths, palm normals
    CalibrationValidator.ts round-trip FK reconstruction check (self-consistency, not units — see
                             docs/REFERENCE_POSE_SPEC.md for why an EXTERNAL ground truth matters too)

  retarget/        Milestone 3: real landmark dataset loading (2D pose + 3D hand points)
    landmarkTypes.ts, LandmarkLoader.ts

  animation/        Milestone 5+: turning a Sign definition into avatar bone rotations
    trajectory.ts    procedural path generators (linear/circular/oscillation)
    signPaths.ts      hand-authored per-sign body-frame keyframes (COFFEE, THANK_YOU, HELLO — the
                       "Sign-schema anchor" the plan refers to)
    BodyFrame.ts       derives right/up/forward/shoulder-width from the avatar's OWN rest pose
    IKSolver.ts         analytical 2-bone IK (law of cosines) + calibration-anchored aim quaternion
    ArmRetargeter.ts    combines the above into per-frame bone rotations + achieved world positions
    KeyframeAnimator.ts  SLERPs bone rotations directly between 2+ human-posed Blender reference
                          poses for the same sign — the PREFERRED animation source once they exist
    AnimationSource.ts   the priority chain: KeyframeAnimator (preferred) -> ProceduralIK (fallback
                          — signPaths.ts + IKSolver). An ORDERED LIST of resolvers, not a hardcoded
                          if/else — a future MotionCapture source is one more resolver appended to
                          the list, no changes to the existing two. This is the ONLY place that
                          decides which source wins; viewers/tests call `resolveAnimationForSign`,
                          never the two sources directly.

  reference/         PERMANENT subsystem: numeric ground-truth comparison AND (once a sign has 2+
                      poses) the literal animation source for KeyframeAnimator above (see
                      docs/REFERENCE_POSE_SPEC.md for the full spec)
    types.ts            ReferencePoseMetadata schema
    ReferencePoseIO.ts   extracts a bone-pose map from an AvatarHierarchy (reused by extraction tool)
    ReferencePoseCompare.ts  compares solver output vs a reference pose — angular + positional error

  tools/            Node-context CLI scripts (run via `npx tsx src/avatar/tools/<name>.ts`)
    inspectSkeleton.ts, runCalibration.ts, validateLandmarks.ts, runArmRetarget.ts
    extractReferencePose.ts, compareReferencePose.ts

  tests/            Vitest, runnable headless (no React/DOM needed for the calibration/animation/
                     reference modules — they're pure Node-compatible logic)

  viewer/           AvatarLab (spec: "debug inside AvatarLab, not inside the game") — React + Three.js
    SkeletonViewer.tsx, LandmarkViewer.tsx, RetargetViewer.tsx, ReferencePoseViewer.tsx,
    AvatarLabPage.tsx (tab switcher, mounted at the dev-only `/avatarlab` route in App.tsx)
```

## Why calibration/animation/reference modules avoid three.js

Everything under `calibration/`, `animation/`, and `reference/` is plain TypeScript with no DOM or
WebGL dependency (`math3d.ts` reimplements the handful of vector/quaternion operations needed rather
than importing three.js). This means:

- The exact same code path runs in Node CLI tools, Vitest (headless, fast), and the browser — one
  source of truth, never a second "browser version" of the math that could drift.
- `three.js` and the viewer components are dev-only and get tree-shaken out of production builds
  entirely (`import.meta.env.DEV` guard in `App.tsx`) — verified by grepping the production bundle
  for three.js-specific identifiers after every viewer change.

## Data flow for one animated sign (current state, Milestone 5)

1. `signPaths.ts` — authored body-frame target positions per frame (`buildSignFrames`).
2. `BodyFrame.ts` — turns the avatar's own rest pose into a right/up/forward/scale frame, and turns a
   body-frame target into a world-space point (`targetWorld`).
3. `ArmRetargeter.ts` — for each frame, solves 2-bone IK per arm (`IKSolver.solveElbow`) and computes
   the local bone quaternions needed to hit that elbow/wrist (`IKSolver.aimLocalQuaternion`), using
   **world-space rest lengths from `hierarchy.bones[...].worldPosition`** — never
   `CalibrationProfile.restChildLengths`, which is local-space/pre-armature-scale and was the root
   cause of a real M5 bug (see git history / REFERENCE_POSE_SPEC.md's threshold rationale).
4. `RetargetViewer.tsx` / `ReferencePoseViewer.tsx` apply those quaternions directly to the live
   Three.js skeleton for visual playback.
5. `reference/ReferencePoseCompare.ts` independently checks step 3's output against a human-posed
   Blender ground truth, in degrees and meters — this is what CI actually gates on.

Not yet built (see `docs/PROJECT_STATUS.md`): finger/palm-roll solving (Milestone 6), full animation
baking with smoothing (Milestone 7), a dedicated verification engine comparing against the real
landmark dataset (Milestone 8), and export (Milestone 9).
