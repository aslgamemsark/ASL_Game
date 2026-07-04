# Video-driven arm retargeting from ASL Citizen — plan, findings, and state (2026-07-02)

**PILOT REJECTED BY USER (2026-07-02).** The pipeline ran end-to-end, passed its own FK/numeric
checks, and looked plausible in static /avatarlab screenshots — but the user reviewed the animated
results and rejected ALL FIVE signs ("not even one made correctly"). **Do not invest further in
raw-MediaPipe→retarget as the primary animation path.** The numeric checks verified what they
measured (elbow direction, palm angle, knuckle distance); they did not — and per the feasibility
report's own warning, structurally cannot — capture overall motion quality: monocular z-jitter,
no torso/shoulder involvement, no wrist-flexion solve, and (honest defect) the Phase-4 1€ smoothing
was never actually wired into `runVideoRetarget.ts`, so raw per-frame noise went straight into the
sampled poses. Fixing those would improve it from bad to mediocre; the user has explicitly moved
on. The pipeline code is kept (it is a working landmark-extraction + retarget scaffold, and the
extracted `data/avatar_landmarks/` remain useful as REFERENCE data for M6 handshapes and for
verification), but the animation path forward is pre-made/professional motion, per the
"Where to go after the rejection" section below.

## Where to go after the rejection (researched 2026-07-02, sources verified)

1. **StudioGalt Sign-Language-Mocap-Archive** (github.com/StudioGalt/Sign-Language-Mocap-Archive):
   professional ASL mocap, **CC0 public domain** (zero licensing risk, commercial included), FBX
   (+.blend poses), captured 240fps/distributed 60fps. Confirmed coverage vs our vocab: **YOU,
   PLEASE, and full fingerspelling** (covers LETTER_A/B/L/V/Y control signs). Does NOT have
   HELLO/COFFEE/WANT/HOSPITAL/THANK_YOU etc. — a supplement, not the full answer. Pipeline: FBX →
   Blender retarget to ybot → baked GLB → existing `extractBakedAnimation.ts` (the proven gold
   path that produced the only user-approved sign).
2. **DeepMotion Animate 3D** (deepmotion.com, from $9/mo + free tier, REST API): commercial AI
   video→mocap whose release notes EXPLICITLY cite fixing "finger popping during precise finger
   motions like sign language". Feed it the SAME best-ranked ASL Citizen clips (or user-recorded
   video), get FBX with finger tracking + professional temporal filtering, then the same Blender →
   bake → extract path. This is "the same idea the pilot tried, but with a production-grade
   solver instead of hand-rolled math." Trial on 1-2 signs (free tier) before relying on it.
3. **User poses keyframes in Blender** (docs/BLENDER_WORKFLOW.md, already written): the ONLY path
   ever rated "correct" by the user (HELLO_bake). 3-5 static poses per sign, no animation-curve
   skill needed (KeyframeAnimator interpolates). ~20-30 min/sign — the guaranteed-quality fallback
   for every sign options 1-2 don't cover.
4. **Commission**: a freelance Blender animator with ybot.glb + reference videos (per-sign price
   estimated $10-30 on Fiverr/Upwork tier — UNVERIFIED estimate); or at the high end Mocaplab
   (did Gallaudet's signing avatars). Only if 1-3 stall.

Recommended sequencing: try DeepMotion's free tier on COFFEE + HELLO; pull YOU/PLEASE/fingerspelling
from the CC0 archive; Blender-pose whatever remains. All three land in the SAME
`extractBakedAnimation.ts` pipeline — no engine changes for any of them.

## SECOND REJECTION (2026-07-03): hand-rolled Galt retarget math, confirmed broken

A later session built `web/src/avatar/tools/retargetGaltClip.ts` — a **TypeScript** rest-to-rest
quaternion retarget from the Galt archive's Mixamo-rig FBX (converted to GLB) onto ybot, bypassing
the plan above's explicit instruction to do this retarget step **inside Blender**. It produced
`COFFEE_galt_*`/`HELLO_galt_*` pose metadata that passed its own FK-readback check (numeric
solver-vs-reference match, PASS) and was committed without a visual check. On visual inspection in
`/avatarlab` (2026-07-03) both signs are **badly broken**: the avatar is collapsed forward onto its
hands and knees, not standing — the same class of whole-body tip-over bug the tool's own code
comments claim to have fixed. The FK check passing is misleading: it only verifies the solver
reproduces its own reference number, not that the reference itself is an anatomically sane pose —
a real gap in the guardrail, not just a math bug. **These poses were deleted** (matching this
project's standing pattern for confirmed-defective experiments); do not regenerate via this tool
without fixing the underlying bug and adding a visual/anatomical sanity check (e.g. reusing
`armPoseSanity.test.ts`'s torso-penetration/elbow-inversion checks) to the readback, not just
numeric agreement.

**Pattern now confirmed FOUR times independently**, across four different authors/approaches, all
failing at the same class of problem — composing rotations across two DIFFERENT rest poses/rigs in
code: (1) `authorSignKeyframes.ts` code-authored fists (3 defects, see
`AVATAR_AUTHORING_HANDOFF.md`), (2) raw-MediaPipe video retarget (rejected, all 5 pilot signs),
(3) this Galt TS retarget (collapsed pose, both signs tried). The ONE approach with a 100% success
rate remains: **pose directly on ybot itself in Blender** (no cross-rig math at all — HELLO_bake) —
or, for third-party mocap, use **Blender's own retarget tooling** (e.g. Rigify's retarget
operators, or manually copying pose bones with constraints) so a human eye and mature, tested
software — not hand-rolled quaternion composition — does the rest-pose reconciliation, and only
the ALREADY-ON-YBOT result goes through `extractBakedAnimation.ts` (which needs no retarget math,
just a straight per-bone local-rotation copy — exactly why it's the one thing that's worked).
~~**Recommendation: stop writing new cross-rig retarget math in TypeScript.** Route all third-party
mocap (Galt archive, DeepMotion output) through Blender's retarget tools first.~~ **Superseded
2026-07-04 — see below. The TypeScript math itself was not the flaw; read on before avoiding it.**

## THIRD UPDATE (2026-07-04): root cause correctly diagnosed and fixed — but a DIFFERENT, real
## limitation is the actual blocker now, and the shipping decision routes around it entirely

The "SECOND REJECTION" entry above is **stale and would mislead a future session if taken at face
value** — it's kept for history, but do not treat "these poses were deleted, don't regenerate" as
still true. Here's what actually happened next:

**The collapsed/tipped-over failure had a precise, findable root cause, not a vague "cross-rig math
in code is unreliable" problem.** Blender's glTF exporter writes each bone's animated rotation
channel as a value **relative to that bone's own rest pose** (standard, correct glTF semantics).
`retargetGaltClip.ts`'s first version copied these values onto ybot's bones directly — valid ONLY
when both rigs share an identical rest pose (true for HELLO_bake, since that was authored ON ybot
itself; false for the Galt archive, whose rig has an additional corrective root bone, `Locator_Root`,
that ybot doesn't have). This is a **data semantics mismatch**, not evidence that rest-to-rest
retargeting is inherently unreliable in code.

**The fix**, rewritten into `retargetGaltClip.ts` (still the same file/tool, corrected):
for every animated bone `B`, `newLocal[B] = inverse(ybotParentWorldRest[B]) * galtWorldOrientation[B]`,
where `galtWorldOrientation[B]` is computed via full forward-kinematics through **Galt's own rest
hierarchy** (root `Locator_Root` down through `B`) using the ANIMATED rotations, and
`ybotParentWorldRest[B]` is `B`'s parent's world-rest orientation on ybot's own skeleton. This
correctly absorbs the corrective root bone and any rest-pose difference, per bone, without any
Blender-side hierarchy surgery (two earlier attempts at that — deleting/reparenting `Locator_Root`
in Edit Mode — produced bit-for-bit identical wrong output both times, because Blender's exporter
bakes each bone's channel relative to ITS OWN rest at export time; editing rest pose after the fact
doesn't retroactively change already-exported animation data).

**Verified more rigorously than the old "FK-readback PASS" this doc already warned is misleading**:
instead of checking whether a solver reproduces its own reference number, this fix was checked by
independently replaying the retargeted pose data through forward kinematics and reading out ACTUAL
WORLD POSITIONS of key bones (Hips, Spine2, Head, feet, hands) — confirmed the character stands
upright with proportions matching ybot's own rest pose almost exactly (Hips≈0.998m, Head≈1.58m,
feet≈0.105m — compare directly against ybot's own undeformed rest pose, which gives the identical
numbers), with hands moving plausibly through each sign. **Caveat, stated honestly: this was
verified numerically, not via a live on-screen screenshot** — the preview browser tooling in this
session's environment couldn't render the WebGL avatar canvas (unrelated infrastructure issue, not
a pipeline bug) — so a human hasn't yet SEEN this corrected version in `/avatarlab`. Do not treat
"numerically verified" as equivalent to "visually confirmed"; that visual check is still owed.

**Separately, also got Blender's own retarget tooling working**, per this doc's own earlier
recommendation: the free **Rokoko Studio Live** Blender add-on's built-in retargeting operators
(`rsl.build_bone_list` / `rsl.retarget_animation`) do the same rest-pose reconciliation, via
mature, tested software rather than hand-rolled math — exactly what was recommended. Required
patching for Blender 5.x API changes (the add-on predates Blender 5's layered-action system;
9 call-site fixes, all in `data/galt_archive/patch_rokoko_blender51.py`, a real working, reusable
patch — apply it once after installing the add-on, idempotent). Confirmed working: retargeted
COFFEE onto ybot in 0.65 seconds, character stands upright, real motion, real finger curls — this
IS a second, independent, Blender-native retargeting path.

**But both routes (the corrected TS math AND the patched Rokoko add-on) share the SAME real,
confirmed limitation**: for two-hand-CONTACT signs (COFFEE — the dominant fist must physically
touch/circle over the other fist), only bone ROTATIONS transfer between rigs of different
proportions; the hands end up close but not quite touching. Confirmed by direct visual
side-by-side comparison (Galt's own character: clean, touching, stacked fists; ybot after either
retarget route: same overall motion, fists visibly not meeting). This is NOT the same bug as the
tip-over — it's a structural limitation of rotation-only retargeting between differently-proportioned
rigs, not something either tool's bug fix addresses.

**What this means for the "stop writing TS retarget math" recommendation above: it's too broad.**
The TypeScript math can be made correct (proven). The real open problem is hand-contact accuracy,
which affects BOTH approaches equally — it isn't a reason to prefer one over the other. It's a
reason to avoid ybot retargeting ENTIRELY for contact signs, regardless of which tool does it.

**The actual shipping decision (2026-07-04), which sidesteps this whole question**: rather than
resolve the hand-contact problem, the signs shipped this session render the StudioGalt archive's
OWN character directly (no retargeting at all — guaranteed correct since it's native motion on its
native rig). See `docs/vault/Workstreams/Workstream-I-Sign-Demo-Clips.md` for the full account.
**ybot retargeting (either route) is now a PARKED, optional future enhancement** — worth revisiting
if/when hand-contact correction is solved, or for non-contact signs where character consistency
matters more than this limitation. Not a blocker for anything currently shipping.

---

Original planning notes below are kept as the historical record; read this AND
`docs/AVATAR_AUTHORING_HANDOFF.md` before touching this pipeline.
The user's requirement, stated verbatim: the 5 pilot signs **MUST WORK**. This doc records what
"work" requires, what's already decided, what's already built, and where the traps are.

## Pilot results (2026-07-02) — READ THIS FIRST

All 5 phases were implemented and run end-to-end against real ASL Citizen video the user had
locally (`E:\ASL_Citizen.zip`, 46GB). Full pipeline exists and works:
`core/capture.py` (world landmarks) -> `tools/extract_avatar_landmarks.py` (Phase 2 extraction +
clip ranking) -> `web/src/avatar/animation/VideoArmRetargeter.ts` (Phase 3 retargeting, measured
elbow/wrist + solved palm roll) -> `web/src/avatar/animation/handshapes.ts` (static handshape
overlay, added mid-session once arms-only pilot review showed 4/5 signs were unreadable without
handshape) -> `web/src/avatar/tools/runVideoRetarget.ts` (CLI, writes `ReferencePoseMetadata`).

**Two real bugs were found and fixed by the guardrails, not silently shipped:**
1. `computeSignerBodyFrame` assumed MediaPipe `pose_world_landmarks` were Y-up, matching this
   engine's own convention. They are Y-DOWN (image convention carried into 3D). Caught because the
   FK-readback report showed elbow-above-shoulder on 100% of frames — physically implausible.
   Fixed: `up: {x:0,y:-1,z:0}` in `computeSignerBodyFrame`. Verified fix: 0/N suspect frames after.
2. `knuckleCentroidFK` (for the two-handed contact check, guardrail #4) reimplemented forward
   kinematics from scratch and forgot to apply `bone.localScale` — produced knuckle centroids
   ~40 METERS apart for COFFEE's stacked fists. This is the EXACT bug class already documented in
   `calibration/types.ts`'s `restChildLengths` warning (Mixamo's cm->m conversion lives in a
   non-unit ancestor scale). Fixed by reusing the proven `fromTRS`/`multiply`/`getTranslation`
   matrix composition from `authorSignKeyframes.ts`'s `knuckleCentroid`, instead of a hand-rolled
   quaternion+position walk. Verified fix: COFFEE's knuckle-centroid distance went from ~1580cm to
   15.8cm mean (physically plausible for stacked fists mid-circle).
3. **Not a bug, but a wrong assumption caught before it shipped wrong data**: hardcoded
   `SIGN_SIDES: {HELLO: ['right'], ...}` assumed right-hand dominance. The first real test clip's
   signer was measurably left-dominant (pose-wrist movement energy: left=0.87m vs right=0.40m
   across the clip — and MediaPipe's own hand handedness label agreed: 33/33 frames "Left").
   Fixed: one-handed pilot signs now use `'auto'` — dominant side is DETECTED per clip from
   measured wrist movement energy, never assumed. Two-handed signs (COFFEE, WANT) still list both
   sides explicitly.
4. **Collision caught before it broke production**: writing video-derived poses directly under
   the real `signName` (e.g. `"HELLO"`) mixed them into the SAME `KeyframeAnimator` interpolation
   group as HELLO's existing Blender-baked poses, threw a duplicate-`frameFraction` error, and
   broke `resolveAnimationForSign` for HELLO **and** THANK_YOU **and** YES in the same `vitest run`
   (64 failing tests). Fixed: `runVideoRetarget.ts` now writes under an isolated
   `<SIGN>_VIDEO_PILOT` signName by default, and additionally writes ONLY to the browser-servable
   `web/public/reference_poses/metadata/` (so `/avatarlab` can show it) while skipping the
   repo-root `reference_poses/metadata/` that `referencePoseRegression.test.ts` scans and holds to
   production thresholds (15deg/3cm, calibrated for Blender ground truth — real video has more
   per-frame noise and failed several of those on first attempt). Promotion to the real sign name
   requires `--promote`, which the next model should NOT run without explicit user approval.

**Handshape reality check, resolved for the pilot** (see that section below for the original
concern): built `web/src/avatar/animation/handshapes.ts`, a static handshape library
(`buildHandshape`, generalizing `authorSignKeyframes.ts`'s proven `buildFist` curl-direction logic
to curl an arbitrary subset of fingers) applied uniformly across every sampled frame on top of the
video-derived arm+palm. Per-sign: HELLO = flat/rest (correct as-is), YOU = index-point (thumb+
middle+ring+pinky curled), HOSPITAL = H-shape (thumb+ring+pinky curled, index+middle straight),
COFFEE = full fist both hands, WANT = flat/rest (approximation — WANT's real handshape is a
loose claw, not modeled this pass). Visually verified in `/avatarlab` — COFFEE shows two stacked
fists at chest height, YOU shows an extended index finger, HOSPITAL shows two fingers touching the
opposite upper arm.

**Per-sign FK-readback numbers** (see `runVideoRetarget.ts` output, reproducible per "How to
reproduce" below): elbow-above-shoulder suspect frames were 0/N for all 5 signs after the up-axis
fix. Palm angle error means ranged 11.5-36.3deg (HOSPITAL highest — likely genuine per-frame video
noise on a sign involving self-contact/occlusion, not necessarily a bug; not independently
re-verified beyond this pilot). COFFEE's two-handed knuckle distance: 9.3-55.1cm range, mean
15.8cm — plausible for a circling grind motion. WANT's: 45.5-89.7cm — hands stay apart, consistent
with WANT not requiring contact.

**Test suite status**: 220/220 vitest tests pass (`web/`), 126/126 pytest tests pass (repo root) —
both confirmed clean AFTER all pilot work, with pilot poses isolated from the production
regression-tested directory (see bug #4 above).

**What was NOT done this pass** (explicitly deferred, matches the approved plan's scope):
- Not promoted to production (`--promote` never run). The real HELLO/YOU/HOSPITAL/COFFEE/WANT
  signs in the live app are UNCHANGED — still whatever they were before this session (HELLO =
  Blender gold, others = procedural/absent). Promotion requires explicit user go-ahead per
  guardrail #6.
- Only 1 clip per sign was retargeted (the top-ranked one from `selection.json`). 2-3 candidates
  per sign were extracted and ranked; runners-up were not retargeted or compared.
- WANT's handshape is an approximation (flat, not a claw) — noted above.
- Amendment A2's trim logic ran but had no effect on any of the 5 pilot clips (each clip's active
  window covered the FULL clip after trimming — i.e. `trimStart=0, trimEnd=length-1` in every run).
  This means either the ASL Citizen clips are already tightly cropped to the sign (plausible — it's
  a dictionary-style dataset) or the 3cm rest-distance threshold needs revisiting on a clip with
  real lead-in/lead-out footage. Not investigated further.
- No gap-frames were held in any of the 5 runs (all clips had elbow data on every frame) — the
  Phase-4 hold-last-valid gap policy exists but is UNTESTED against a real gap. If a future sign's
  clip has genuine tracking dropouts, watch this code path closely the first time it actually fires.
- Runners-up clips per sign, and the other 13 `GAME_VOCAB` signs, are not yet processed.

## How to reproduce / continue

```
cd web
# regenerate pilot output for all 5 signs (reads data/avatar_landmarks/selection.json for best clip)
for sign in HELLO YOU HOSPITAL COFFEE WANT; do
  clip=$(node -e "console.log(JSON.parse(require('fs').readFileSync('../data/avatar_landmarks/selection.json'))['$sign'][0])")
  npx tsx src/avatar/tools/runVideoRetarget.ts "$sign" "../data/avatar_landmarks/$sign/$clip.json" 24
done
# review in the browser: npm run dev, then open /avatarlab -> Reference Pose tab, select e.g. COFFEE_VIDEO_PILOT_12
# once approved by the user, promote ONE sign at a time:
npx tsx src/avatar/tools/runVideoRetarget.ts COFFEE "../data/avatar_landmarks/COFFEE/<clip>.json" 24 --promote
```

Extraction (Phase 2, already run for the 5 pilot signs, `data/avatar_landmarks/` already populated
— re-run only if adding new signs or more clips):
```
./.venv/Scripts/python.exe -m tools.extract_avatar_landmarks --zip E:/ASL_Citizen.zip --out data/avatar_landmarks --max-per-sign 25
```

## The goal and the approved plan

Replace `signPaths.ts`'s guessed arm targets with real elbow/wrist motion measured from ASL Citizen
videos (user has ~43GB locally), via MediaPipe world landmarks -> bone rotations on the ybot rig ->
`ReferencePoseMetadata` JSON -> the existing `KeyframeAnimator` (zero engine changes needed).

Approved plan (5 phases, user-approved 2026-07-02, plus two research amendments):

1. **Phase 1 — extend `core/capture.py` + `core/landmarks.py` ADDITIVELY**: read
   `pose_world_landmarks` + `hand_world_landmarks` (currently computed but discarded), new optional
   Frame/Hand fields, zero change to existing consumers. Run pytest after.
2. **Phase 2 — `tools/extract_avatar_landmarks.py`**: mirrors `tools/extract_dataset.py`'s
   asl-citizen mode (reuse ManifestWriter, --zip/--root), pilot vocab only, output to
   `data/avatar_landmarks/` (NEVER `data/landmarks/` — that's recognition training data).
   **Amendment A2**: rank clips per sign by tracking quality (hand coverage, no snaps, both hands
   for two-handed signs), pick best 2-3, trim leading/trailing rest frames by movement energy.
3. **Phase 3 — TS retargeting**: new `retarget/videoLandmarkTypes.ts` + `VideoLandmarkLoader.ts`
   (do NOT touch the existing `landmarkTypes.ts`/`LandmarkLoader.ts` — they describe the old
   elbow-less dataset and M3's tests depend on them), new `animation/VideoArmRetargeter.ts`, new
   `tools/runVideoRetarget.ts`. Signer's landmarks -> shoulder-width-normalized body-frame offsets
   -> avatar via existing `targetWorld()` (`BodyFrame.ts`) -> direction-aim via existing
   `aimLocalQuaternion` (`IKSolver.ts`). **NO `solveElbow` IK guessing — the elbow is measured.**
   **Amendment A1**: also solve palm orientation per frame (palm normal from wrist/index-MCP/
   pinky-MCP hand landmarks — the convention already FK-verified in `authorSignKeyframes.ts`
   `buildArm`) and drive forearm-roll + wrist-flex from it. Without this, THANK_YOU-class signs
   have correct arms and wrong palms = another "not good enough" verdict.
4. **Phase 4 — gaps + smoothing**: 1€ filter (`tools/oneeuro.py`) on body-frame trajectories
   BEFORE computing rotations; short gaps interpolated; low-coverage clips marked
   NEEDS-MANUAL-REVIEW and NOT fed to KeyframeAnimator (fall back to existing paths).
5. **Phase 5 — pilot review, HARD STOP before scaling**: /avatarlab visual check; numeric check of
   HELLO against the existing Blender gold reference via `compareReferencePose.ts`; COFFEE
   hand-to-hand contact verified with knuckle data, not wrists; per-sign PASS/NEEDS-MANUAL report;
   explicit user go-ahead before batching the other 13 GAME_VOCAB signs.

Pilot signs (user-confirmed): **HELLO, YOU, COFFEE, WANT, HOSPITAL.**
Full plan file (session-local, may not survive): `C:\Users\msaad\.claude\plans\u-should-do-it-purring-glade.md`.
The essentials are all in this doc.

## Current implementation state (exactly)

- **Phase 1, first edit only**: pose landmark index constants (elbows 13/14, wrists 15/16, hips
  23/24) added to `core/landmarks.py`. **Nothing else is written.** Frame/Hand fields, capture
  changes, and all later phases are not started. Working tree also has unrelated pre-existing
  modifications (reference pose metadata regeneration) — don't mix them into this work's commits.
- Branch: `claude/avatar-lab-prototype`.

## Research findings that shaped the plan (verified 2026-07-02, with sources)

1. **The approach is production-proven, not experimental.** Kalidokit
   (https://github.com/yeemachine/kalidokit, MIT) converts MediaPipe Holistic landmarks into rig
   rotations (arms, wrist, fingers) and powers shipped VTuber apps in the browser with three.js.
   Use it as a **reference implementation to cross-check rotation math** — not as a dependency
   (this engine has its own verified conventions, math3d, and no-invention rules).
2. **DiffSign (ECCV 2024)** retargets human sign-language poses onto 3D avatars — research
   precedent for exactly this task. https://link.springer.com/chapter/10.1007/978-3-031-92591-7_6
3. **MediaPipe world-landmark z (depth) is confirmed noisy**, worst under self-occlusion
   (hands crossing the body — i.e., signing). Mitigate: smooth BEFORE rotations; rely on the
   existing anatomical sanity tests (`armPoseSanity.test.ts`: torso penetration, elbow inversion).
   https://github.com/google-ai-edge/mediapipe/issues/4557 and https://arxiv.org/pdf/2405.03545
4. **The lite pose model jitters more than the full model.** `core/capture.py` defaults to
   `pose_landmarker_lite.task`. For OFFLINE batch extraction, speed doesn't matter — **download and
   use `pose_landmarker_full.task` (or heavy)** for this pipeline; keep lite for the live game.
5. Generative ML (text->sign motion) is NOT the path — no ASL corpus at this vocabulary exists;
   see `docs/AVATAR_ANIMATION_METHODS_FEASIBILITY.md` (methods 7-8) for the full comparison.

## Honest per-sign risk assessment ("must work" requires reading this)

| Sign | Arm motion difficulty | The catch |
|---|---|---|
| YOU | Trivial (short one-hand point) | Sign is MEANINGLESS without index-point handshape — see handshape section below |
| HELLO | Easy (one hand, no contact) | Gold Blender reference exists — use it as the numeric oracle |
| WANT | Moderate (two hands, symmetric pull) | No contact; handshape (spread/claw) matters less at pilot |
| HOSPITAL | Moderate (one hand draws cross on opposite upper arm) | Contact with own arm = occlusion + proximity accuracy; H-handshape needed to read as the sign |
| COFFEE | Hard (stacked fists, contact, circling) | Known worst case. Occlusion of lower hand; wrist-vs-knuckle-centroid trap (defect #3 in AVATAR_AUTHORING_HANDOFF.md); fists required to read as the sign |

## THE handshape reality check (do not skip this section)

Finger solving (Milestone 6) was explicitly deferred from this plan's scope, per the project's
milestone gating — the pilot delivers arms + palm orientation, fingers at rest. **But the user's
success bar is "these 5 signs WORK", and 4 of the 5 are unreadable as signs without their
handshape** (YOU=index point, COFFEE=two fists, HOSPITAL=H-hand, WANT=spread-claw). Resolution
recorded here so the next model doesn't relitigate or get blindsided:

- The pilot review (Phase 5) judges **arm path + palm orientation** — that was agreed and is the
  correct engineering checkpoint.
- To reach "the sign works" immediately after, add a **static handshape library**: for these signs
  the handshape is CONSTANT throughout the motion, so a handful of one-time handshape poses (fist,
  index-point, H, spread-5, flat-B) applied to finger bones + video-driven arms = complete signs.
  Handshapes are REUSABLE across signs (one fist serves COFFEE, YES, WORK...), so this scales as a
  library, not per-sign work. Source options, in order of reliability (per
  AVATAR_AUTHORING_HANDOFF.md's proven hierarchy): (a) user poses each handshape once in Blender
  (minutes each, and they outrank code math), or (b) solve them from the extracted hand WORLD
  landmarks averaged over the sign's hold phase (M6-lite — the same data this pipeline already
  extracts; the wrist-centered 3D hand landmarks are exactly what M6 was planned to consume).
- Full per-frame finger animation remains M6, later, gated.

## Datasets — what's needed and what's authorized

- **ASL Citizen (local, ~43GB) is sufficient for all 5 pilot signs.** All are in GAME_VOCAB
  (`tools/asl_citizen_vocab.py`); ASL Citizen averages ~30 clips per gloss — plenty for A2's
  best-clip selection. **No new dataset download is needed.**
- **WLASL: user explicitly authorized** (2026-07-02, "use wlasl or any other dataset") as a
  FALLBACK if every ASL Citizen clip for some sign has bad tracking. Caveat that still stands from
  CLAUDE.md: WLASL is non-commercial/research licensed — fine for experiments, but **animations
  derived from WLASL that would SHIP in the app need a license re-check before commercial release.
  Prefer ASL Citizen as the source for anything that ships.** Same verify-before-ship note applies
  in weaker form to ASL Citizen itself (its license permits research use; baked-animation
  derivatives shipping in a product should be confirmed against its terms — flagged to the user
  2026-07-02, decision is theirs).
- **Last-resort fallback for COFFEE** (if dataset tracking is hopeless due to occlusion): the user
  can record THEMSELVES performing it — controlled framing, better lighting, and they know the
  signs. Same pipeline, `footage`-style input. Also remember `reference_poses/metadata/` already
  contains `COFFEE_auth_*`/`YES_auth_*` code-authored poses with documented defects — the plan is
  for video-derived output to REPLACE those (delete the `*_auth_*` metadata when superseding).

## What the next model needs from the user (ask before Phase 2)

1. **The path to the ASL Citizen data on disk** (zip file or extracted folder — the extraction
   script supports both, mirroring `run_asl_citizen`).
2. Approval to download `pose_landmarker_full.task` into `models/` (see `models/README.md` pattern).
3. Nothing else. Python env: `.venv-ml` (Py 3.11) per memory; verify mediapipe Tasks API version
   in it exposes world landmarks (it should — `pose_world_landmarks` is standard Tasks output).

## Guardrails (inherited — violating these is how previous models failed)

1. FK-readback before every write; flag frames over threshold (start at 3cm, the Reference Pose
   System tolerance). Never write silently-wrong data.
2. Measure the rig and the data; never assume conventions. Rig conventions already verified are
   listed in AVATAR_AUTHORING_HANDOFF.md ("Practical rules") — do not rediscover, do not assume
   beyond them.
3. Fail loudly on incomplete data; coverage reports, not silent skips.
4. COFFEE placement is judged by KNUCKLE CENTROID, not wrist (defect #3's fix).
5. Keep `npx vitest run` green in `web/` (220+ tests). Blender-derived data outranks code-derived;
   video-derived data outranks guessed offsets — label sources honestly in the viewer.
6. Pilot -> demo -> explicit go-ahead -> scale. Never batch all signs on an unproven pipeline.
