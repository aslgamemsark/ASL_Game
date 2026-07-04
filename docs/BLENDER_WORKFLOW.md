# Blender Workflow — Creating a Reference Pose

Goal: adding a new reference pose should require only these 5 steps. Everything after step 5 is
automatic (mirroring, indexing, the JSON extraction itself).

## 1. Open Blender

Open (or create) `reference_poses/blender/<poseId>.blend`, with the same Y-Bot rig used everywhere
else in this project (`ybot.glb`, `mixamorig:` bone-name prefix). If starting fresh, import
`E:\ASL_Game\ybot.glb` (or `web/public/models/avatar/ybot.glb` — same file) so the bone names and
rest pose match exactly what the engine loads.

## 2. Pose the avatar

Enter Pose Mode. Pose the rig to match one specific, well-defined moment of the sign — not an
average or a blend of the whole motion. Good choices:

- **HELLO** — the outward/extended moment of the wave (matches `frameFraction: 1.0` in
  `signPaths.ts`'s authored path, which ends at the outstretched position).
- **THANK_YOU** — either the starting chin-contact moment (`frameFraction: 0.0`) or the final
  forward/down moment (`frameFraction: 1.0`). Pick one and record it — don't guess later.
- **COFFEE** — any specific angle of the dominant fist's grind circle (e.g. the top of the circle,
  `frameFraction: 0.0`, or a quarter-turn in).

Write down which moment you posed — you'll need it as `frameFraction` in step 5. There's no way to
recover this from the GLB alone.

Only rotate bones. Don't scale or translate individual bones (translation is captured too, but the
comparison math assumes bone *lengths* stay at their rest values — moving a bone's translation off
its rest value will silently break the positional-error math, not just look odd).

## 3. Insert a keyframe

With every posed bone selected (Pose Mode → select all relevant bones, or the whole armature), press
`I` → **Rotation** (or **LocRot** if you also moved anything, though you shouldn't have) on frame 1.
This isn't for making an animation — it's just the simplest reliable way to make Blender's glTF
exporter treat this as a deliberate pose rather than exporting the rest pose.

## 4. Export GLB

File → Export → glTF 2.0 (`.glb`):
- Format: `glTF Binary (.glb)`
- Include → Animation: **checked** (this is what carries your posed rotations out — without it,
  Blender exports the rest pose and the extraction tool will silently read a T-pose).
- Compression: off (keep it simple and lossless for now).
- Save as `reference_poses/glb/<poseId>.glb` — e.g. `reference_poses/glb/HELLO.glb`.

## 5. Run the extraction tool

From `web/`:

```
npx tsx src/avatar/tools/extractReferencePose.ts <poseId> <signName> <frameFraction>
```

Example:

```
npx tsx src/avatar/tools/extractReferencePose.ts HELLO HELLO 1.0
```

This reads the GLB you just exported, extracts every bone's local rotation/translation, writes
`reference_poses/metadata/HELLO.json`, mirrors both the metadata and the GLB into
`web/public/reference_poses/`, and updates the pose index the AvatarLab viewer reads. It will fail
loudly (exit 1) if the GLB is missing, the sign name doesn't exist in `signPaths.ts`, or the bone
count doesn't match the rest rig (a sign the export used a different/re-processed armature).

## Verifying it worked

```
npx tsx src/avatar/tools/compareReferencePose.ts <poseId>
```

Prints per-bone angular error and wrist/elbow positional error against the current solver, and
PASS/FAIL. You can also open `/avatarlab` → **Reference Pose** tab in the dev server to see the
reference pose and the solver's output side by side in 3D, with the same numbers.

## Committing

Commit all of: `reference_poses/blender/<poseId>.blend`, `reference_poses/glb/<poseId>.glb`,
`reference_poses/metadata/<poseId>.json` (+ updated `index.json`), and the
`web/public/reference_poses/` mirror of the last two. From then on,
`referencePoseRegression.test.ts` checks this pose on every test run — a future change to the
solver that breaks it will fail CI, not just look wrong the next time someone opens AvatarLab.

## Multi-keyframe signs: driving the animation, not just verifying it

A single reference pose is verification-only (compared against the procedural IK output). **Give a
sign 2 or more reference poses and it automatically switches to being the actual animation source**
(`AnimationSource`'s `KeyframeAnimator`, preferred over procedural IK — see `docs/ARCHITECTURE.md`).
No code change is needed per sign; `resolveAnimationForSign` picks this up by itself. This is the
recommended way to fix a sign whose current animation looks wrong: your poses replace the guessed
`signPaths.ts` offsets and 2-bone IK solve entirely for the bones you captured.

### Steps (repeat steps 1-5 above once per keyframe)

For a 3-keyframe sign like HELLO (start → middle/peak → end of the wave):

1. Pose the **start** moment. Insert a keyframe. Export as `reference_poses/glb/HELLO_start.glb`.
2. Pose the **middle** moment (a new pose, same rig, doesn't need to be in the same `.blend` file as
   step 1 — separate files are fine). Export as `reference_poses/glb/HELLO_mid.glb`.
3. Pose the **end** moment. Export as `reference_poses/glb/HELLO_end.glb`.
4. Run extraction once per pose, with **distinct, ordered `frameFraction` values** (this is what
   tells the interpolator the sequence — never inferred):
   ```
   npx tsx src/avatar/tools/extractReferencePose.ts HELLO_start HELLO 0.0
   npx tsx src/avatar/tools/extractReferencePose.ts HELLO_mid   HELLO 0.5
   npx tsx src/avatar/tools/extractReferencePose.ts HELLO_end   HELLO 1.0
   ```
   All three share the same `signName` ("HELLO") — that's what groups them into one animation.
5. Open `/avatarlab` → **Retarget** tab, select HELLO. It should now say
   **"Source: KEYFRAME-DRIVEN (Blender)"** instead of "PROCEDURAL IK (fallback)".

### What gets interpolated, and what doesn't

Only bones present in BOTH keyframes on either side of a given moment in time get interpolated for
that stretch — a bone one keyframe didn't capture is left alone for frames in that bracket, never
guessed. If you only posed arm bones, only arm bones animate; fingers stay at rest until you either
pose them too or Milestone 6's finger solver exists. Two keyframes is the minimum; more keyframes
give the interpolator more, smaller (smoother) segments to work with — there's no fixed limit.

### Why separate GLBs instead of one animated GLB

Today's extraction tool reads a GLB's bind/rest transform, not baked animation channels — so each
keyframe must be its own file. A single GLB with a baked Action (multiple animated frames) would be
more convenient per sign, but requires new glTF animation-sampler parsing that hasn't been built —
ask for it if the per-keyframe-file workflow becomes a bottleneck.
