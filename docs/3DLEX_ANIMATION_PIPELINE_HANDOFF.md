# 3D-LEX animation pipeline — handoff (2026-07-09)

How word-sign animations get from the **3D-LEX** dataset (938 Unreal-exported mocap FBXs) into
playable clips in the app. Read this before touching `data/3dlex/`, `data/galt_archive/render_demo_clips.py`,
or adding a new word sign sourced from 3D-LEX. It assumes you already have Blender 5.1 installed
(`C:/Program Files/Blender Foundation/Blender 5.1/blender.exe` on this machine) and Python with
`imageio_ffmpeg` available (`pip install imageio_ffmpeg` if not).

**This pipeline is separate from, and not a replacement for, StudioGalt's clips** (`docs/AVATAR_AUTHORING_HANDOFF.md`
covers that one). 3D-LEX is a second animation source used for words StudioGalt doesn't have
(HOSPITAL, DOCTOR, NURSE, WATER, WANT, YES, HELP, WRITE, READ, TEACHER so far).

## TL;DR — add a new 3D-LEX word to the app

```bash
# 1. Convert FBX -> GLB (do NOT use Blender's own FBX importer or the dataset's own ASL_ANIM_GLB.zip — see "Two traps" below)
"node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe" -i data/3dlex/ANIM_FBX/<word>.fbx -o data/3dlex/ANIM_GLB_converted/<word>.glb --binary

# 2. Render (produces a PNG sequence)
"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background --python data/galt_archive/render_demo_clips.py -- \
  data/3dlex/ANIM_GLB_converted/<word>.glb data/galt_archive/demo_clips/3dlex_<WORD>_frames word

# 3. Encode to MP4 — add <WORD>: "<word>" to the SIGNS dict in encode_3dlex_clips.py first
python data/galt_archive/encode_3dlex_clips.py

# 4. Wire it in web/src/data/signs.ts — add clip: '/clips/<WORD>.mp4' to that sign's entry
```

Then spot-check the output (see "Verifying a render" below) before committing — some words in
3D-LEX have no usable animation data at all (see "Checking if a word is usable" below), and that
only shows up as a static/frozen render, not a script error.

## Why this pipeline exists (the eInheritRrSs bug)

3D-LEX's FBXs are exported from Unreal Engine and use a transform-inheritance mode called
`eInheritRrSs` that **Blender's native FBX importer silently mishandles** — no warning, no error,
just progressively garbled mesh deformation the further any bone rotates from rest (looks almost
fine near a T-pose, collapses into a mangled clump the more the character moves). This cost a full
debugging session (2026-07-09) — Preserve Volume, Apply Pose as Rest Pose, and all six Recalculate
Roll axis options were tried and ruled out in the Blender GUI before the actual cause was found.

**The fix**: convert the FBX to GLB using `fbx2gltf` (the npm-packaged build of Facebook's
FBX2glTF tool) *before* touching Blender. `fbx2gltf` correctly detects and compensates for
`eInheritRrSs` — its own conversion log even prints a warning about it. This is the same tool used
by Oline Ranum's NGT200 paper (ICML 2024 GRaM workshop) for retargeting 3D-LEX onto a synthetic
signer, via `https://github.com/J-Andersen-UvA/BabylonSignLab` — that's where this fix was found.

### Two traps that look like shortcuts but aren't

1. **Don't import the FBX into Blender directly** (`bpy.ops.import_scene.fbx` /
   `data/galt_archive/convert_to_glb.py`, which wraps the same native importer) — that's the exact
   bug above. `convert_to_glb.py` exists for a *different* pipeline (StudioGalt/Mixamo rigs for the
   avatar-synthesis retarget work) and does not apply here.
2. **Don't use `data/3dlex/ASL_ANIM_GLB.zip`**, the dataset's own pre-packaged GLB export, hoping
   it skips the conversion step. Checked directly (2026-07-09, `hello.glb` from that zip): it
   renders as a collapsed stub — a couple of shoe meshes floating near the bottom of frame, rest of
   the body missing/deformed away. Whatever exported that archive has its own, different problem.
   Always regenerate from `ANIM_FBX/` via `fbx2gltf` yourself.

## Setup (one-time)

```bash
mkdir some-scratch-dir && cd some-scratch-dir
npm install fbx2gltf
# binary lands at: some-scratch-dir/node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe
```

`npx fbx2gltf --version` does **not** work (the npm package doesn't expose a bin entry point that
way) — invoke the platform binary directly, as in the TL;DR above. This doesn't need to live
inside the repo; any scratch location works, you just need the path to the `.exe`.

`data/3dlex/ANIM_FBX/` already has all 938 words extracted from `ASL_ANIM_FBX.zip` (word name =
filename, e.g. `water.fbx`). `data/3dlex/ANIM_GLB_converted/` currently only has the 10 words
already wired into the app — convert more into that same folder as needed.

## Checking if a word is usable before rendering it

**203 of the 938 words (21.6%) have zero animation channels in the source FBX** — same class of
defect as the already-known-dead FRIEND/MEDICINE/NAME/PAIN. This isn't visible from the filename;
you find out either when `fbx2gltf` logs `"has zero channels. Skipping."` during conversion, or
(worse) after rendering, as a perfectly static/frozen clip.

Check a single word:
```bash
"node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe" -i data/3dlex/ANIM_FBX/<word>.fbx -o /tmp/test.glb --binary
# look for "zero channels" in the output
```

Check the whole archive (takes a while, ~938 conversions):
```bash
FBX2GLTF="node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe" ./data/galt_archive/scan_3dlex_coverage.sh
```
This reproduces the **735/938 (78.4%) usable** figure from 2026-07-09 and writes
`data/galt_archive/3dlex_coverage_scan.tsv` (word / OK / ZERO_CHANNELS / CONVERT_FAILED). Worth
re-running if you're hunting for a specific word not yet checked — DIZZY, EMERGENCY, FEVER, MORE,
and SICK were confirmed **absent from 3D-LEX's vocabulary entirely** (not even a dead FBX exists
for them), so don't waste time looking for those here specifically.

## Rendering

`data/galt_archive/render_demo_clips.py` handles both StudioGalt FBX and 3D-LEX GLB sources in one
script (it branches on file extension). For 3D-LEX:

```bash
"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background --python data/galt_archive/render_demo_clips.py -- \
  data/3dlex/ANIM_GLB_converted/<word>.glb data/galt_archive/demo_clips/3dlex_<WORD>_frames word
```

`word` is the camera preset (full body — use `letter` instead for a tighter chest+hand framing, if
you're ever rendering fingerspelling from a similar source). Output is a PNG sequence
(`f0001.png`, `f0002.png`, ...), not a video yet.

The script does a fair amount of source-specific correction that's worth understanding if a new
word renders wrong — see inline comments in the script itself for the full reasoning on each; in
short:
- **Non-deforming stray mesh exclusion**: `fbx2gltf` GLBs sometimes carry a leftover ~2-unit
  "Icosphere" placeholder alongside the real character. Excluded from framing/render automatically
  (anything without an Armature modifier).
- **Mesh/armature transform reset**: on 3D-LEX sources the mesh object's own `matrix_world` can
  carry a different rotation than its parent armature, garbling deformation. Reset to identity
  automatically when an Armature modifier is present.
- **Keyframe range detection**: scans actual keyframe points rather than trusting
  `action.frame_range` (unreliable/garbage on some FBX exports). Not usually an issue for GLB
  sources but shared code path with StudioGalt.
- **Root-motion recentering**: parents everything under a fresh un-animated "RecenterOffset" empty
  and offsets *that*, because directly editing `object.location` on a source with keyframed root
  motion gets silently overwritten every frame during `bpy.ops.render.render()`.
- **Camera facing**: 3D-LEX GLB characters face **-Y** at rest — opposite StudioGalt's **+Y** — so
  camera position/rotation is chosen based on file extension (`.glb`/`.gltf` vs `.fbx`).
- **Broken-texture fallback + skin/clothing/eye split** (the big one — see next section).

### The broken-texture fallback: why the character isn't a pale blob

3D-LEX's GLBs are **Ready Player Me avatars with exactly ONE material for the entire body** — no
separate skin vs. clothing materials to begin with (unlike StudioGalt's painted textures) — and
that one material's texture is broken (unresolved/1×1 placeholder image, not embedded in the FBX).
Left alone, Blender renders broken textures as solid magenta; a single flat fallback color for the
whole body (tried first) rendered as a uniformly pale "white on white" blob with no skin/clothing
contrast at all, and a blank face with no visible eyes.

The fix (see `render_demo_clips.py` around `has_broken_texture`) rebuilds that contrast
procedurally, using the standard Ready Player Me / Mixamo rig bone names:

1. **Skin vs. clothing, general case (torso/neck/collar)**: every vertex gets a continuous 0–1
   "skin score" from how much of its rig weight goes to skin bones (head/neck/hands/forearms) vs.
   everything else, then that score is smoothed by averaging with mesh neighbors over several
   passes before thresholding. A hard per-vertex "which single bone dominates" pick (tried first)
   flips somewhat unevenly at bone-weight blend zones — ordinary weight-painting noise — and a
   majority vote over that turns it into a jagged sawtooth line instead of a clean one. The
   smoothing pass fixes that without moving the boundary's anatomical location.
2. **Sleeve hem specifically (elbow): an exact geometric plane cut, not weight-smoothing.** The
   elbow was the one boundary users actually look closely at, and weight-smoothing alone left a
   visible zigzag there no matter how many iterations were added (12 vs. 24 iterations produced an
   *identical* remaining notch — confirmed it's a genuine ambiguous weight-paint transition at that
   joint, not removable noise, so more smoothing was never going to fix it). The real fix: read the
   armature's own rest-pose bone positions (`bones["LeftForeArm"].head_local` = the elbow joint,
   `.tail_local` = the wrist) and cut with a plane through the elbow, oriented perpendicular to the
   forearm bone — every vertex weighted to the `LeftArm`/`LeftForeArm` chain is classified purely by
   which side of that plane it's on, not by any per-vertex weight value at all. This gives a
   mathematically clean ring around the arm regardless of mesh triangulation, confirmed clean both
   at rest and mid-motion (bent elbow). Same idea for `RightArm`/`RightForeArm`. If another boundary
   ever needs this treatment (e.g. a v-neck collar that still looks jagged after smoothing), this is
   the pattern to reach for — general smoothing is the cheap first try, an exact bone-rest-position
   plane cut is what actually guarantees a clean line at a specific joint.
2. **Eyes**: Ready Player Me characters have real, separate eyeball geometry (verified by probing —
   ~120 vertices per eye with >0.9 weight to the `LeftEye`/`RightEye` bones, in a tight ~4cm
   bounding box; this is not just eyelid skin lightly influenced by an eye-look blendshape). That
   geometry gets a pale sclera color instead of the same flat skin tone as the rest of the face, so
   the eyes are visible instead of disappearing into the face.
   - **A pupil/iris dot was attempted and deliberately dropped.** Every vertex-selection approach
     tried (rest-position depth, XZ-centroid distance, vertex-normal direction, even the exact 3D
     camera-facing vector computed from the actual render camera, verified against a rendered
     normal-direction heatmap) landed on the same result: this rig's eyeball's true geometric front
     pole is occluded by the eyelid/socket rim, so there's no reliable per-vertex signal for where a
     pupil should visually sit. Forcing one in anyway would mean guessing at rig detail the source
     doesn't actually give us — the exact mistake this project already got burned by on
     code-authored avatar poses (see `docs/AVATAR_AUTHORING_HANDOFF.md`). If you want to take
     another run at this, the eyeball vertex group is real and there — but validate any placement
     with an actual rendered check (a bright, saturated debug color at full selection first, then
     narrow down) before trusting it, the same way this was ruled out.

This whole fallback branch is a no-op on StudioGalt sources (their materials have no broken-texture
nodes), so it's safe to leave in place regardless of source.

## Verifying a render

Don't just trust "the script exited 0" — some 3D-LEX words are dead in the source (see coverage
section above) and render as a static/frozen clip with no error. Check a representative mid-motion
frame:

```python
from PIL import Image
im = Image.open("data/galt_archive/demo_clips/3dlex_<WORD>_frames/f0036.png")
im.save("check.png")
```
Then look at `check.png` (or a couple of frames a dozen apart) — confirm there's actual visible
hand/arm movement between them, not the same static pose repeated.

## Encoding to MP4

`data/galt_archive/encode_3dlex_clips.py` is the 3D-LEX counterpart to the existing
`encode_clips.py` (which is StudioGalt-only). Add your word to its `SIGNS` dict
(`"<SIGN_NAME>": "<3dlex-glb-basename>"`), then:

```bash
python data/galt_archive/encode_3dlex_clips.py
```

Outputs land directly in `web/public/clips/<SIGN>.mp4`. One difference from the StudioGalt
encoder: **no frame-1 skip** — StudioGalt FBX exports carry a T-pose calibration frame at frame 1
that has to be skipped to avoid a jarring flash at the start of every loop; 3D-LEX GLB sources
don't have that (frame 1 is already a natural rest pose, verified visually), so all frames are
encoded from frame 1.

## Wiring a new sign into the app

Add `clip: '/clips/<SIGN>.mp4',` to that sign's entry in `web/src/data/signs.ts`. If it's a
genuinely new sign (not already in the vocabulary), it also needs a rule-based verifier definition
in `signs/` per the project's core recognition architecture (see the root `CLAUDE.md` — every sign
needs a movement spec, not just a static handshape check) before it's usable as a practice/quiz
target, not just a reference clip.

## Coverage snapshot (2026-07-09)

- **41 signs live** (26 StudioGalt + 10 3D-LEX words: WATER, DOCTOR, HOSPITAL, WANT, YES, HELP,
  NURSE, TEACHER, WRITE, READ + 5 StudioGalt letters wired this session)
- **1 pending** (THANK_YOU — from the Fab pack, not 3D-LEX, blocked on a separate Unreal Editor
  export step)
- **4 confirmed unusable from 3D-LEX** (FRIEND, MEDICINE, NAME, PAIN — zero animation channels)
- **5 genuinely absent from every source checked** (DIZZY, EMERGENCY, FEVER, MORE, SICK) — not in
  StudioGalt, not in 3D-LEX's 938-word vocabulary, not in the Fab pack. These need either a new
  data source or self-recorded fixtures — 3D-LEX is exhausted for these specific words.
- Full detail: `docs/vault/Sign-Animation-Coverage.md`.

See also `data/galt_archive/3dlex_coverage_scan.tsv` (once you've run the scan script) for the
per-word OK/ZERO_CHANNELS breakdown across all 938 words, useful if you're looking to expand beyond
the current 51-sign vocabulary later.
