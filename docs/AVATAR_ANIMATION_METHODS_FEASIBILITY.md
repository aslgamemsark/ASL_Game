# Sign-language avatar animation methods — feasibility report (2026-07-02)

Scope: every viable way to produce ASL sign animation for the browser-based three.js avatar
(`web/src/avatar/`), evaluated against the pipeline already built there — an `AnimationSource`
chain (KeyframeAnimator, SLERP between reference poses > ProceduralIK fallback), a Mixamo-style
"ybot" rig, GLB reference poses, and the constraint from `CLAUDE.md` that recognition/animation
stays client-side. Grounded in the confirmed defects and lessons in
[`AVATAR_AUTHORING_HANDOFF.md`](AVATAR_AUTHORING_HANDOFF.md).

Two research passes fed this report: one covering traditional/classical graphics methods, one
covering ML-driven methods. Every method below cites primary sources.

---

## TL;DR

There is no shortcut that beats **human-authored keyframes** for quality, and no cheap way to get
hundreds of natural-looking signs without either (a) a fluent signer's time in front of a camera or
Blender, or (b) a research-grade ML pipeline that doesn't yet exist for ASL at your vocabulary size.
The literature independently confirms what you already learned the hard way: **pure procedural/math
authoring is a documented failure mode ("robotic and unrealistic motion"), not a bug you can code
your way out of.** Every shipped sign-avatar product (TESSA, ATLASLang, VCom3D, DePaul's Paula,
ASL Champ!) uses rule-based lookup or motion-capture-authored clips — none use generative ML in
production. Your current architecture (Blender-baked clips as gold path, procedural IK as fallback)
matches industry practice, not lags it.

**Recommended path, in priority order:**
1. Keep Blender-baked keyframes (method 1) as the gold path — it's the only method your own project
   has already validated as "correct."
2. Add **video-driven authoring**: record a fluent signer, run MediaPipe Holistic (already in your
   stack) or a Blender mocap add-on (BlendArMocap) to solve bone rotations, then bake to GLB — this
   is the best cost/quality tradeoff for scaling past hand-keyframing every sign individually.
3. Use **MediaPipe Face Landmarker's ARKit-blendshape output** for non-manual markers (facial
   grammar) — production-ready today, runs client-side, and glTF morph targets are a solved
   three.js pattern. This is a clear, low-risk win you haven't built yet.
4. Do **not** invest in text/gloss-to-pose generative ML (SLP transformers/diffusion) — no ASL-scale
   3D training corpus exists at your vocabulary's domain; it's a multi-year research bet, not a
   feature you can ship.

---

## Comparison table

| Method | Equipment/skill needed | Cost | Time per sign | Naturalness ceiling | Scales to 100s of signs? | Browser/three.js fit | Maturity |
|---|---|---|---|---|---|---|---|
| **1. Manual keyframing (Blender/Maya) → GLB** | Animator + Blender skill | Free (time cost) | Hours | **Highest** — only method your project rated "correct" | Poor — animator-hours bound | Excellent (already your gold path) | Production-proven (VCom3D, DePaul Paula) |
| **2. SiGML/HamNoSys notation (JASigning)** | Linguist to transcribe HamNoSys | Free/licensed | Minutes once transcribed | Low-medium — literature calls it "robotic" | Excellent in theory | Poor — no browser/three.js player exists; would need to be built from scratch | Legacy, ~stagnant since ~2016 |
| **3a. Optical mocap (Vicon/OptiTrack)** | Studio, marker suits, calibration | $30k–£150k+ | Fast per-session once rigged, high fixed cost | High | Good if budget exists | Needs retarget step (BVH→GLB), standard | Mature, expensive |
| **3b. IMU mocap (Xsens/Rokoko) + gloves** | Suit + gloves + software | $2.7k–$9k full kit | Fast per-session | High for body, drift risk over long sessions | Good | Needs retarget step | Mature, indie-affordable |
| **4. Video → rig retargeting (MediaPipe/BlendArMocap)** | Camera + Blender add-on | Free/near-free | Minutes–hours (cleanup) | Medium — monocular noise, finger occlusion is the known weak point | **Good — cheapest scalable option** | Best alignment: reuses your existing `@mediapipe/tasks-vision` stack for authoring | Some tools abandoned/forked (BlendArMocap), pattern is proven |
| **5. Procedural/algorithmic IK from linguistic params** | Engineer, no capture hardware | Free (engineering time) | Fast to author, high fixed cost to build correctly | **Lowest** — literature-documented "robotic" failure mode, matches your 3 confirmed defects | Excellent in theory | Best pure-JS fit (THREE.IK) but the exact method that already broke | This project's own fallback; known weak |
| **6. ARKit/MediaPipe blendshapes for facial NMMs** | Rig with 52 morph targets + MediaPipe Face Landmarker | Free | Real-time capture, near-zero marginal cost | High for general expression, imperfect for ASL-specific mouth morphemes | Excellent, sign-count-independent | **Best fit of all methods** — production-ready today, client-side, glTF-native | Production-ready (Google-shipped) |
| **7. SLP generative ML (text/gloss→pose transformer)** | ASL-scale parallel text+3D-pose corpus, ML/GPU expertise | High (data collection + training) | N/A — one-time model build | Medium — recognizable but poor co-articulation/grammar per SLRTP2025 evals | Bounded by training corpus, not truly open-vocab | Inference plausible in-browser (ONNX/TF.js) once trained | **Research-only**, no ASL corpus at this scale exists |
| **8. Diffusion motion synthesis (SignAvatars-based)** | Even larger 3D motion corpus, heavier GPU budget | Very high | N/A | Smoother than transformer regression but still corpus-bound | Same corpus bottleneck as #7 | Poor for live use (multi-step denoising); OK for offline pre-bake | **Research-only**, papers from 2023–2026, unconsolidated |
| **9. Video→3D mesh reconstruction of existing ASL corpora (4D-Humans/WHAM+WiLoR)** | GPU inference + manual QC pass | Medium (compute + cleanup labor) | Seconds–minutes GPU + cleanup per clip | Good body, hands are the known weak point (same problem you already hit) | **Most scalable for "arbitrary vocabulary"** — can process ASL Citizen/WLASL/How2Sign directly | Offline only; output is a bakeable GLB clip | Components mature (open-source, maintained); composite pipeline is assembled per-paper, not turnkey |
| **10. Commercial AI mocap APIs (DeepMotion, Move.ai, Plask)** | Video upload, credit-based API | $9–$50+/mo, per-second credits | Minutes per clip | Medium — DeepMotion explicitly cites sign-language finger-tracking fixes in changelog | Good, pay-per-sign | FBX/BVH output needs retarget to GLB, not live-browser | Production SaaS, vendor lock-in risk |

---

## Method write-ups

### 1. Manual keyframe animation (Blender/Maya → GLB) — your current gold path
Human animator poses the rig directly; exported via glTF. This is exactly how HELLO was produced
(`extractBakedAnimation.ts`) and the only sign your project rated correct without caveats.
Real precedent: VCom3D's Sign4Me product line and DePaul University's "Paula" avatar (26+ years of
development) both rely on large hand/expert-curated sign libraries, not generative synthesis.
**Bottleneck is purely animator-hours** — there is no shortcut to naturalness here, only to volume.

Sources: [DePaul ASL Avatar Project](https://asl.cs.depaul.edu/), [VCom3D signing avatar overview](https://snow.idrc.ocadu.ca/assistive-technology-2/augmentative-processing/animated-signing-characters-signing-avatars/), [MMS Player (arXiv 2507.16463)](https://arxiv.org/pdf/2507.16463)

### 2. SiGML/HamNoSys notation-driven avatars (JASigning/eSIGN)
A phonetic sign notation (HamNoSys) compiled to XML (SiGML) drives a procedural avatar player.
Elegant in principle — write a sign once as structured linguistic data, get an animation for free —
but the JASigning player is a legacy desktop Java app with no browser/three.js equivalent, and its
own literature admits procedural output looks robotic. Not worth building a from-scratch SiGML
player for a two-person team; conceptually it's the same trap as method 5 with extra ceremony.

Sources: [JASigning docs](https://vh.cmp.uea.ac.uk/index.php/JASigning_Demos), [Ham2Pose (arXiv 2211.13613)](https://arxiv.org/pdf/2211.13613)

### 3. Motion capture (optical, IMU, gloves)
Real hardware capture gives high naturalness but at real cost: Vicon/OptiTrack studios run
$30k–£150k+; Xsens/Rokoko IMU suits with hand gloves run $2.7k–$9k fully loaded. ASL-specific
capture needs three simultaneous streams (body + fine handshape + face) that no single consumer rig
covers — published datasets (3D-LEX, French/Czech SL corpora) stitch Vicon + Manus gloves + separate
facial capture together. Glove calibration is also flagged as burdensome per-session. This is
viable only with real budget; given the project's indie scale, IMU+gloves ($2.7k–$9k) is the
realistic tier if you ever go this route, not optical.

Sources: [Rokoko vs Xsens comparison](https://www.rokoko.com/insights/xsens-vs-rokoko-honest-motion-capture-comparison-for-creators), [3D-LEX v1.0 (arXiv 2409.01901)](https://arxiv.org/pdf/2409.01901)

### 4. Video-driven pose retargeting for authoring (MediaPipe/BlendArMocap) — recommended addition
Record a fluent signer on ordinary video; extract landmarks with MediaPipe Holistic (the same
Tasks-API family already in your recognition stack); solve bone rotations onto the rig (e.g. via the
open-source Blender add-on **BlendArMocap**, which does exactly this against Rigify-style rigs,
though the original maintainer has stepped back — active forks exist under `freemocap`); bake the
result to GLB via your existing `extractBakedAnimation.ts` path. This reuses tooling you already
have, costs only a camera and a signer's time, and turns a manual keyframing task into a
record-and-clean-up task. Known weak point: monocular finger occlusion — expect a cleanup pass, same
as any mocap pipeline, but starting from a much better initial guess than pure math.

Sources: [BlendArMocap](https://github.com/cgtinker/BlendArMocap), [MediaPipe for Dummies](https://www.assemblyai.com/blog/mediapipe-for-dummies)

### 5. Procedural/algorithmic IK from linguistic parameters — your existing fallback, use sparingly
Drive the rig directly from the five-parameter sign schema (handshape/location/movement/
orientation/NMMs), no capture data. Attractive because it could reuse `core/schema.py` directly, and
runs natively in three.js (THREE.IK/FABRIK). But the literature is unambiguous: "procedural animation
often results in robotic and unrealistic motions," and real systems that use it hybridize with mocap
"ambient motion" to compensate. This is precisely the class of bug documented in
`AVATAR_AUTHORING_HANDOFF.md` (wrong curl direction, skipped fingers, misaligned circle center) —
not implementation mistakes but a known ceiling of the method itself. Keep it as the fallback it
already is; don't invest further engineering trying to make pure procedural output look natural.

Sources: [Survey on animation of signing avatars (HAL)](https://hal.science/hal-03005762), [THREE.IK](https://github.com/jsantell/THREE.IK)

### 6. Facial blendshapes for non-manual markers (NMMs) — recommended addition, high confidence
MediaPipe Face Landmarker outputs the 52 industry-standard ARKit blendshape coefficients directly
from webcam video, fully client-side, no training required — same library family you already ship.
glTF/GLB natively supports morph targets and three.js has first-class support for driving them live.
Author the avatar's face mesh once with the 52 ARKit-standard blendshapes (a one-time modeling task;
open-source Blender add-on `ARKitBlendshapeHelper` can auto-generate them), then either capture NMMs
live from a signer's face per sign (cheap, real-time) or hand-key them. This is the single clearest,
lowest-risk gap in your current pipeline — non-manual markers aren't mentioned in your architecture
docs at all yet, and this method is production-ready today.

Sources: [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker), [three.js forum: MediaPipe facial tracking demo](https://discourse.threejs.org/t/3d-avatar-real-time-facial-tracking-using-mediapipe-face-landmark/51590), [ARKitBlendshapeHelper](https://github.com/elijah-atkins/ARKitBlendshapeHelper)

### 7–8. Generative ML (text/gloss→pose transformers, diffusion) — not viable at your scale
Sign Language Production (SLP) research (Progressive Transformers, T2S-GPT, SignGraph, diffusion
variants like Neural Sign Actors, Sign-IDD) is a real, active 2024–2026 research area, but every
serious benchmark (RWTH-PHOENIX-14T, SignAvatars) is either German Sign Language or a narrow domain
(weather broadcasts), not ASL at coffee-shop-scenario vocabulary. No production system uses this;
the SLRTP2025 challenge (33 teams, 231 submissions) confirms this is still an open research problem,
not a shippable feature. Diffusion variants are additionally too slow for live/real-time browser
inference (multi-step denoising) even where trained. Revisit only if an ASL-scale 3D-pose parallel
corpus for your vocabulary appears — not worth building yourself.

Sources: [Progressive Transformers](https://content4all-project.eu/progressive-transformers-for-end-to-end-sign-language-production/), [SignAvatars](https://signavatars.github.io/), [SLRTP2025 challenge results](https://arxiv.org/html/2508.06951v1)

### 9. Automatic 3D reconstruction from existing ASL video corpora (ASL Citizen/WLASL/How2Sign)
Run human mesh recovery (4D-Humans, WHAM) plus dedicated hand reconstruction (WiLoR, which is
specifically strong on "challenging hand poses") over existing ASL video datasets you're already
licensed to use, then retarget the resulting SMPL-X motion onto your ybot rig and bake to GLB. This
is the most scalable path to covering an arbitrary vocabulary without recording new video yourself —
How2Sign has already had this done to it in research (SMPL-X annotated extension). The catch: it's a
server-side/offline GPU pipeline you'd have to assemble from open components (no turnkey tool exists
for this specific combination), and hand fidelity is still the known weak point — expect a cleanup
pass on hand-to-hand and hand-to-face contact signs (which is a large fraction of ASL). Worth a
scoped experiment on a handful of signs before committing.

Sources: [4D-Humans](https://github.com/shubham-goel/4D-Humans), [WiLoR](https://github.com/rolpotamias/WiLoR), [How2Sign SMPL-X extension (arXiv 2304.10482)](https://arxiv.org/pdf/2304.10482)

### 10. Commercial AI mocap APIs (DeepMotion, Move.ai, Plask, Wonder Studio, RADiCAL)
Upload video, get back FBX/BVH motion via a credit-based API. DeepMotion is notable: its own release
notes explicitly reference fixing "finger popping during precise finger motions like sign language,"
meaning they've identified and iterated on your exact use case. Cost is modest ($9–50/mo entry tiers,
credit-metered), but output still needs a retarget step to your GLB rig, and none of these vendors
validate ASL-specific accuracy — you'd be the one doing QC. Reasonable to trial on a few signs as a
faster alternative to building your own video→rig pipeline (method 4/9), but introduces vendor
dependency and per-sign cost that scales with vocabulary size.

Sources: [DeepMotion Animate 3D pricing](https://www.deepmotion.com/pricing-animate3d), [DeepMotion release notes](https://www.deepmotion.com/release-updates)

---

## What NOT to do (and why), matched to your own findings

- **Don't scale up procedural/IK math (method 5) as the primary path.** You already found 3 concrete
  defect classes; the wider literature calls this a structural ceiling of the method, not a solvable
  engineering problem. Keep it as a fallback only, as it already is.
- **Don't build a custom SiGML player.** No existing browser implementation, legacy/stagnant
  ecosystem, same "robotic" ceiling as method 5, plus you'd be maintaining a parser for a notation
  system with no active community.
- **Don't chase generative ML (methods 7–8) for launch.** No ASL corpus at your scale exists; every
  shipped competitor avoids this for exactly that reason.

## What's worth prototyping next

1. **Facial blendshapes (method 6)** — lowest effort, highest confidence, fills a real gap (NMMs
   aren't handled by your pipeline at all today).
2. **Video-driven authoring via MediaPipe/Blender (method 4)** — reuses your existing stack, turns
   sign authoring from "hand-key everything" into "record + clean up," directly addresses the
   scaling bottleneck of method 1.
3. **A scoped experiment with method 9 or a commercial API (method 10)** on ~5 signs from ASL Citizen
   footage, to see whether hand-contact signs (COFFEE-like) come out clean enough to be worth
   building a full pipeline around, before committing engineering time either way.
