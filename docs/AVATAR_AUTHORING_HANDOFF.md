# Avatar keyframe authoring — handoff notes (2026-07-02)

Written by the model that built `web/src/avatar/tools/authorSignKeyframes.ts` after the user
evaluated its output ("better than other models, not good enough") and switched models.
**Read this before touching sign authoring, finger curls, or the avatar engine's animation path.**
It documents exactly what worked, what failed, WHY it failed, and what not to repeat.

## Context in one paragraph

The avatar engine (branch `claude/avatar-lab-prototype`, module `web/src/avatar/`) animates signs
via an `AnimationSource` priority chain: KeyframeAnimator (SLERP between reference poses, preferred
when a sign has >=2 poses) -> ProceduralIK (guessed signPaths offsets, fallback). Reference poses
can come from three generators: `extractReferencePose.ts` (static Blender GLB),
`extractBakedAnimation.ts` (baked Blender clip — this produced HELLO, the quality gold standard so
far), and `authorSignKeyframes.ts` (code-authored, FK-verified — produced THANK_YOU, COFFEE, YES).
User verdict per sign: HELLO (Blender clip) = correct. THANK_YOU (code-authored, arm only) =
"correct". COFFEE + YES with code-authored fists = visibly flawed, three specific defects below.

## What WORKED (keep doing this)

1. **Never author blind — FK readback before writing.** The tool solves authored intent through the
   validated 2-bone IK, then forward-kinematics the result and PRINTS where the wrist, palm normal,
   and finger direction actually ended up. This caught an inverted roll convention, an inverted
   wrist-tilt convention, and a mis-centered COFFEE circle before the user ever saw them. Any new
   authoring code must keep this loop.
2. **Measure the rig, never assume conventions.** Both the forearm-roll sign and the wrist-flex sign
   on this rig were the OPPOSITE of what I assumed; only the FK readout revealed it. Chin/chest
   positions are read from the rig's actual bone positions, offsets expressed in shoulder-width
   units.
3. **Anatomical intent as the authoring language.** "Circle of radius 0.11 SW centered over the left
   fist, palm rolled toward the signer's right" is reviewable and fixable; raw quaternions are not.
4. **The pipeline itself.** ReferencePoseMetadata -> KeyframeAnimator -> AnimationSource needed ZERO
   changes to accept code-authored poses, two-handed signs, or finger bones. The architecture is
   sound; the authored CONTENT is what has quality limits.

## What FAILED — the user's three confirmed defects, root causes, and fixes

### 1. Some fingers curled in the WRONG DIRECTION
`buildFist()` picks each finger's curl direction automatically by trying both signs of rotation and
keeping whichever brings the fingertip closer to the wrist. **That metric is nearly symmetric:
hyperextending a finger backward over the back of the hand ALSO shortens tip-to-wrist distance** by
almost the same amount as a proper curl. So for some fingers (thumb especially, whose geometry is
oblique) the wrong direction won.
**Fix:** decide direction with the palm normal, not tip-to-wrist distance: a correct curl moves the
fingertip to the PALM side, so require `dot(tip - mcp, palmNormal) < 0` (palm normal =
`cross(indexMCP-wrist, pinkyMCP-wrist)` for the right hand, flipped for the left — this convention
is already implemented and FK-verified in `buildArm()`'s palm report). Tip-to-wrist distance is
still useful as a TIGHTNESS metric (optimum measured ~91mm on ybot; larger curl angles OVERSHOOT —
85/105/75 degrees made it worse than 70/95/60), just not as a direction test.

### 2. Some fingers were NOT curled at all
`buildFist()` iterates `hierarchy.hands[side].fingers` and silently skips any finger whose chain is
missing/empty, and only curls the first 3 joints of however many the chain has. Nobody ever printed
WHICH bones actually received a curl, so a silently-skipped finger (e.g. a chain the skeleton
discovery classified differently) was invisible in the numeric report — the report only tracked the
MIDDLE fingertip.
**Fix:** make the FK fist report enumerate every finger by name with its own tip-to-palm distance
and FAIL LOUDLY (like everything else in this engine) if `fingers` has fewer than 5 chains for a
hand doing a fist. Verify against `avatarHierarchy.json`: ybot has 5 chains x 4 joints per hand —
if the tool curled fewer, that's a discovery-classification bug to chase in SkeletonInspector
output, not a tuning problem.

### 3. COFFEE's circle doesn't visually center over the bottom fist
I centered the RIGHT WRIST's circle over the LEFT WRIST's position. But a fist's visual mass (the
knuckles) sits ~10cm+ beyond the wrist along the hand direction, and the two hands' wrist-to-knuckle
offsets point in DIFFERENT directions (top hand fingers forward, bottom fist rolled thumb-up). So
wrist-over-wrist produced knuckles-visibly-off-center.
**Fix:** author and verify hand placement using the KNUCKLE CENTROID (mean of the 4 MCP world
positions, available via the same FK-with-overrides used everywhere in the tool), not the wrist
joint. Concretely: FK the bottom fist first, compute its knuckle centroid, then set the top hand's
wrist targets such that the TOP hand's knuckle centroid traces the circle over the BOTTOM centroid.

## The deeper lesson (why "not good enough" was predictable)

FK numbers verify what you MEASURE, and each defect above was a quantity I wasn't measuring (curl
side vs palm, per-finger coverage, knuckle centroid vs wrist). Numeric verification only converges
to visual quality if every visually-salient property has a metric. Two ways forward, in order of
reliability:

1. **Human keyframes stay the gold path.** HELLO (user's Blender baked clip ->
   `extractBakedAnimation.ts`) is the only sign the user called correct without caveats. Blender
   poses/clips from the user beat authored math every time; code-authored signs are a stopgap and
   should be REPLACED as Blender files arrive (delete the `*_auth_*` metadata, re-extract).
2. **For handshapes specifically, use the real dataset — this is Milestone 6, already planned.**
   `asl_landmarks_for_friend.zip` has GOOD 21-point 3D hand landmarks (multi-signer). Finger curls
   should ultimately be SOLVED from that data (palm-plane + per-finger direction vectors + the
   calibrated rest->target quaternion approach in the spec), not hand-tuned in degrees. The arm
   data is what's missing from the dataset (no elbow, no depth) — hands are covered.

## Practical rules for the next model

- Run `npx tsx src/avatar/tools/authorSignKeyframes.ts <SIGN>` (verify mode) and READ the FK report
  before every `--write`. If you add a new visual property, add it to the report first.
- Conventions on this rig you do NOT need to rediscover (all empirically verified): negative
  `forearmRollDeg` = supination (right arm); negative `wristFlexDeg` = fingertips tilt up; rest
  palms face DOWN in T-pose; `frame.right` points to the SIGNER's right = world -X.
- The regression suite auto-covers every pose file: `npx vitest run` in `web/` (each pose
  round-trips through resolveAnimationForSign). 220 tests as of this note — keep it green.
- The RetargetViewer label must never claim "Blender" for code-authored poses (fixed 2026-07-02;
  pose metadata `notes`/`generatorVersion` say which generator made it).
- Don't relitigate the AnimationSource design: ordered resolver chain, KeyframeAnimator preferred,
  ProceduralIK fallback, extensible for a future MotionCapture/solver source. User-approved.

## What the USER needs to provide for this project to reach quality (told to them directly)

1. **Blender clips (or 3+ static poses) for each priority sign** — the proven path. One baked GLB
   per sign, any filename, then `extractBakedAnimation.ts <PREFIX> <SIGN> <file.glb>`.
2. **Nothing new for handshapes** — the existing zip's hand landmarks suffice for M6.
3. **Only if procedural ARMS must get good without Blender:** re-extract their source videos with
   MediaPipe Holistic/Pose WORLD landmarks (33-point, includes elbows + metric-ish depth) — the
   current 2-point-2D pose schema cannot drive arm retargeting, and no model can fix that by
   reasoning harder.
