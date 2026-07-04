# Workstream I — Sign demo clips: from webcam video to StudioGalt archive renders (2026-07-04)

## Context

The user asked broadly: "give me viable ways to make avatars work" for showing learners an
accurate sign demonstration. This picked up directly where [[VIDEO_RETARGET_HANDOFF]] left off (the
video-retargeting pilot was already rejected in an earlier session). Extensive research + hands-on
verification this session; see that doc's "THIRD UPDATE" section for the ybot-retargeting-specific
findings. This note covers the parts of the session not already recorded there: dataset research,
the render-from-archive pipeline that actually shipped, and the live bugs found along the way.

## Dataset research (extensive; most ruled out)

Searched broadly for any better source of accurate 3D ASL sign data before committing to a plan.
Full list, with why each was or wasn't pursued:

- **StudioGalt Sign-Language-Mocap-Archive** (CC0, professional Vicon+StretchSense mocap) — the one
  actually used. Covers only ~12-20 of this app's signs today (built alphabetically, deep in A–D,
  sparse elsewhere) but the coverage is real and verified by cloning the archive's file tree
  directly (`git clone --filter=blob:none`), not by trusting a README summary.
- **3D-LEX v1.0** (1,000 ASL signs, Vicon + StretchSense gloves + iPhone ARKit face capture,
  CC BY 4.0 — commercial-OK-with-attribution) — best coverage/license combo found, but its public
  download link is dead (OSF repository returns empty via direct API check). Access request email
  sent to the author (o.ranum@surrey.ac.uk); **no reply yet as of this session**.
- **NVIDIA "Signs" ASL dataset** (signs-ai.com; NVIDIA + American Society for Deaf Children) — 3D
  avatar demo signs + a gated dataset of raw video, images, and landmark/pose/facial-mesh JSON.
  Access application submitted via NVIDIA's official form. **Real, specific risk flagged to the
  user before applying**: the dataset appears to include crowdsourced webcam-video-derived
  landmarks (not exclusively hardware mocap) — if so, it may reproduce the exact jitter/quality
  problem that got the original video pilot rejected. A single-sign visual pilot with a hard
  kill-gate (no partial-credit smoothing attempt) is the agreed plan if/when access arrives — not
  yet started.
- **SignAvatars** (70K sequences, SMPL-X) — CC BY-NC-SA, **non-commercial only**; same trap as
  WLASL. Not pursued further given the app's commercial ambiguity.
- **Ruled out with reasons** (checked directly, not assumed): AWS GenASL (built on ASLLVD, which
  this project already excludes by standing decision; also requires ongoing AWS cloud costs) ·
  Neural Sign Actors / phonology-guided diffusion papers (no public code/model) · Vcom3D
  SigningAvatar (real but old desktop tech, proprietary) · sign-language-translator PyPI package
  (Pakistan Sign Language, not ASL) · CWASA/JASigning (real, browser-based, but notation-authored
  not mocap-driven — a fundamentally different authoring workflow) · MMS-Player (real open-source
  pipeline, but needs sign files that don't exist yet for our vocab) · various commercial
  text-to-sign APIs (CODA, Silence Speaks, VSL Labs, SignAvatar.org — closed products, not assets).

A 2026 academic survey (Frontiers) confirming no ASL dataset with native 3D mocap exists beyond
what's already found was a useful sanity check — the search wasn't missing an obvious better option.

## What shipped: render-from-archive pipeline (Phase 1 of the approved plan)

Plan file (outside the repo, in the Claude Code plans directory) covers full phase breakdown,
standing policies, and the 2026-07-18 timeout for the pending dataset replies. Summary of what's
now live:

- `data/galt_archive/render_demo_clips.py` — headless Blender script, two camera presets ("word"
  for full-body signs, "letter" for fingerspelling — tuned iteratively: first attempt cropped the
  hand out entirely, second cropped the head out, third is the shipped framing).
- `data/galt_archive/encode_clips.py` — PNG frame sequence → H.264 MP4 via `imageio-ffmpeg`
  (bundles its own ffmpeg binary; no system ffmpeg was installed). Skips frame 1 of every sequence
  — confirmed via direct frame inspection that the Galt archive's FBX exports carry a T-pose
  calibration frame at frame 1 before the real motion begins at frame 2 (present in HELLO/PLEASE/
  BREATHE/letters, absent in COFFEE/YOU — a real per-file inconsistency in the archive, not a bug
  in this pipeline).
- **12 signs shipped**: HELLO, PLEASE, YOU, COFFEE, BREATHE, LETTER_A/B/L/V/Y/W/I — all re-rendered
  from webcam video (or newly added, for BREATHE/LETTER_W/LETTER_I) to the archive's own CC0
  character.
- **3 signs dropped, not replaced**: THANK_YOU, WANT, YES — no archive coverage; the user's
  standing rule is no human/webcam video anywhere, so these now show a placeholder rather than an
  old webcam clip.

## Live bugs found and fixed while auditing `signs.ts` (not part of the original ask)

1. **8 signs 404'd in production**: `HELP, PAIN, MEDICINE, EMERGENCY, FEVER, WATER, HOSPITAL, DIZZY`
   had a `clip:` field pointing at files that never existed in `web/public/clips/`. Removed the
   dangling references.
2. **`ReferenceClip.tsx` had no fallback** for a missing or failed-to-load clip — rendered a blank
   video box. Now shows a "demo coming soon" placeholder (`onError` handler + conditional render).
3. **Root `.gitignore`'s blanket `*.mp4` rule was silently shadowing `web/public/clips/`** despite
   the teammate's earlier commit message claiming clips were unblocked — that commit only edited
   `web/.gitignore`, and gitignore rules cascade from the repo root, so only `PLEASE.mp4` had ever
   actually been committed. Fixed with a targeted negation. Also discovered `data/` is fully
   gitignored (correctly, for the huge ML dataset bulk it holds) — which meant every Blender
   pipeline script written this session (and in the earlier `retargetGaltClip.ts` session) was
   invisible to git. Added a narrow exception for `data/galt_archive/*.py` specifically, keeping
   the large FBX/PNG/MP4 intermediates alongside them ignored.

## Verification gap, stated honestly

Could not get a live click-through of the running app (lesson → sign screen → clip playing) to
complete in this session's browser-automation environment — clicks registered and React state
updated correctly under the hood (confirmed via console logs and direct state/DOM inspection), but
the screen transition itself never visually completed. Root cause traced to the preview tab
reporting `document.visibilityState: "hidden"` with no real focus, which throttles
`requestAnimationFrame` — and this app's screen transitions use `framer-motion`'s
`AnimatePresence mode="wait"`, which blocks mounting the next screen until the current one's exit
animation finishes. Tried several workarounds (forcing `document.hidden`/`visibilityState` via
`Object.defineProperty`, patching `requestAnimationFrame` to a `setTimeout` shim, mocking
`getUserMedia` to bypass the camera-permission gate, bypassing onboarding via `localStorage`) — each
made real progress (got past onboarding, past the camera-permission screen) but the animation lock
persisted. **Asked the user to verify manually** (`npm run dev`, open a lesson, confirm clips play)
rather than claim an unverified success.

What WAS verified directly, without relying on the stuck browser session: every MP4 is independently
readable (checked frame count/fps/resolution via OpenCV), every `signs.ts` clip reference matches an
existing file 1:1 with zero dangling links or orphaned files, `npx vitest run` (247/247) and
`npm run build` both pass, and all 12 rendered signs were visually reviewed via contact sheets
(sampled frames across each clip) before encoding.

## State at end of session

Committed to branch `claude/sign-demo-clips-2026-07-04` (not pushed — awaiting the user's go-ahead
and their own manual verification). Not merged, no PR opened yet.

## Related notes
- [[VIDEO_RETARGET_HANDOFF]] — the ybot-retargeting research this workstream continued from; read
  its "THIRD UPDATE" section for the corrected root-cause diagnosis and the hand-contact limitation
- [[AVATAR_AUTHORING_HANDOFF]] — rig conventions, still relevant if ybot retargeting is revisited
- [[Decisions-Log]] — should be extended with this session's judgment calls (archive-render-over-
  retargeting as the default policy, the 2026-07-18 dataset timeout) — not yet done as of this note
