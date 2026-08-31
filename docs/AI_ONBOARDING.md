# QuickSign — AI Onboarding Brief

_Last updated: 2026-07-21. Read this if you are a fresh AI instance (any model, any tool) picking
up this project with zero prior context. It is self-contained — you shouldn't need to open another
file to understand what this project is and how it's organized, though pointers to deeper docs are
given throughout for when you need to actually change something._

## 1. What this is, in one paragraph

**QuickSign** is a gamified web app that teaches American Sign Language (ASL) and checks, via the
user's own webcam, whether they actually produced each sign correctly — not just whether they can
recognize it in a video. It's built by a two-person student team (Saad + a teammate, ARKhan) as a
React/TypeScript single-page app, live in production at **https://quicksignn.vercel.app**, currently
prepping a public Reddit launch. The core technical differentiator, and the thing every design
decision below serves, is: **most ASL apps show a video and ask "which sign is this?" (recognition).
QuickSign watches the user sign and tells them which specific part — handshape, location, movement,
palm orientation — was wrong (production feedback).**

## 2. Who's building it and how

- Two developers, scenario-by-scenario. Saad owns the `coffee_shop` scenario; ARKhan owns
  `hospital_shop`. `classroom` was added later; ownership not firmly assigned.
- Neither developer is Deaf — this is explicitly acknowledged in the app's own public messaging
  (see `docs/REDDIT_LAUNCH.md`) and is a known limitation, not glossed over.
- Development is AI-assisted (Claude Code). The repo carries an unusually detailed set of binding
  engineering-discipline rules under `.claude/rules/` (Ousterhout-derived software design principles
  — modules, information hiding, error handling, naming, comments, plus a full concurrency/systems bug
  taxonomy). If you're an AI editing this codebase, read those before writing code — they're not
  optional style notes, they're enforced conventions with a documented history of the bugs they exist
  to prevent (see §7, "the COFFEE bug").

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | SPA, `web/` is the app root |
| Styling | Tailwind CSS v4 | |
| State | Zustand | `web/src/stores/` |
| Auth/DB/Realtime | Supabase (Postgres 17) | RLS on all 13 tables; project `juzqilqilxzmudazltjx` |
| Hosting | Vercel | project `asl-game`, prod branch = `main`, auto-deploys on push |
| Analytics | PostHog | org "QuickSign", project 518794 (US region) |
| Sign recognition | MediaPipe Tasks API (Hand + Pose landmarker) + a hand-rolled rule engine + a small TF.js Bi-GRU classifier | all client-side, in-browser — **no video or landmarks are ever streamed to a server for recognition** |
| Multiplayer | WebRTC P2P + Supabase Realtime for signaling | no game server; free OpenRelay TURN as the $0 default |
| 3D avatar (parked) | Three.js, GLB rigs | separate subsystem, currently paused — see §8 |
| Python (prototype/ML side) | MediaPipe + OpenCV + numpy, `ml/` training scripts | the original v1 prototype; still used for ML training and some tooling, not the shipped web app's runtime |

There are actually **two parallel implementations of the sign-recognition rule engine**: a Python one
under `core/`/`signs/`/`scenarios/` (the original v1 prototype, per `CLAUDE.md`) and a TypeScript one
under `web/src/engine/` (what's actually shipped in the web app). They're meant to stay conceptually
in sync ("dual-engine parity" — see `docs/vault/Architecture.md`) but the **TypeScript engine is what
runs in production today**. If you're asked to fix a recognition bug for the live app, you almost
certainly want `web/src/engine/`, not `core/`.

## 4. The sign-recognition architecture (the most important part to get right)

Every ASL sign is defined by **five parameters**: handshape, location, movement, palm orientation,
and non-manual markers (NMMs — facial expression/grammar). This is linguistic fact, and the whole
codebase is architected around never approving a sign match without checking every parameter the
sign actually requires.

**Non-negotiable rule, backed by a real shipped bug:** a verifier must never approve a sign that
requires movement by looking at a single video frame. The original COFFEE checker only checked "two
fists, roughly the right distance apart" on one frame and falsely passed a user holding two static
fists with zero motion — COFFEE actually requires the dominant hand to circle over the non-dominant
fist. Movement (linear/circular/repeated) must be validated over a **rolling window of ~1.5–2 seconds**
of landmark history, never the current frame alone. Any new sign-recognition code that checks only
handshape + location for a sign involving movement is repeating this exact bug class — push back on
it if you see it being asked for.

**The architecture that prevents repeats (TypeScript, in `web/src/engine/`):**
1. **Sign definitions as data** — `createSign()` in `web/src/engine/signs/index.ts` builds
   `SIGNS: Record<string, Sign>` from arrays like `COFFEE_SIGNS`/`HOSPITAL_SIGNS`/`CLASSROOM_SIGNS`.
   Each declares required handshape(s) per hand, spatial relationship, movement type + thresholds,
   palm orientation, NMMs. **This is the authoritative recognition source** — it's what
   `recognition.startLoop()` and the on-screen `ParameterChecklist` component actually consume
   (via `ENGINE_SIGNS` in `web/src/pages/LessonPage.tsx` and siblings).
2. **`web/src/data/signs.ts`** is a *separate*, **display-only** registry (`SIGNS: Record<string,
   SignDef>`) that holds the user-facing description/hint/how-to-sign text shown in lessons. It is
   **not** consulted by the recognizer. This is a known, tolerated information-hiding wrinkle (the two
   files can drift, and did — see §7) — if you ever change what a sign's engine spec requires, check
   whether the display text in `data/signs.ts` still describes the same handshape/motion, or a user
   will be told to do one thing and fail for doing exactly that.
3. **Generic verifier engine** (`web/src/engine/` scoring code, e.g. `handshape.ts`'s
   `HANDSHAPE_SCORERS` lookup table) returns a confidence score per parameter. Overall pass requires
   **every** parameter marked `required: true` to individually clear its own threshold — never an
   averaged score.
4. **Confusor test suite** — every sign ships with a fixture of the correct sign AND a fixture of the
   likeliest accidental false positive, replayed through the verifier as automated tests
   (`web/tests/` or `src/**/tests/`, Vitest).
5. **Dev-only debug overlay** — live per-parameter scores on screen during development.
6. **Real calibration discipline** — thresholds aren't guessed once and left; real calibration runs
   are logged in `docs/CALIBRATION_LOG.md` with exact before/after values and the specific confusor
   behavior that justified the change. A `minConfidence` still sitting at the "0.25 uncalibrated
   default" is a known-bad pattern that has failed every confusor tested against it so far.
7. **All spatial thresholds are ratios of shoulder width** (from pose landmarks), never raw pixels,
   so recognition works regardless of how close the user sits to the camera.
8. **The ML classifier (Bi-GRU, TF.js) is veto-only** — a disambiguation layer that can turn a rule
   *pass* into a *fail*, but can never turn a fail into a pass. It does not replace the rule engine.
   Trained on ASL Citizen (licensed) + WLASL (authorized 2026-06-30, non-commercial/research license
   — must be re-checked before any commercial release, see `docs/LICENSING_CHECKLIST.md`). Covers 23
   of 51 signs and zero fingerspelled letters; ~66% standalone accuracy, which is fine because it only
   ever vetoes, never grants, a pass.

If you're asked to add or fix a sign, use the **`new-sign` skill** in this repo (`.claude/skills/` or
invoke via `/new-sign`) — it encodes this whole pattern and its anti-bug gate so you can't
accidentally recreate the COFFEE-class bug or the "passes on a synthetic fixture but fails on a real
human" trap (see §7).

## 5. Repo layout

```
CLAUDE.md              Project primer — read every session; source of the rules referenced above
PROJECT_MEMORY.md       Single-page "state of the world": infra, analytics, launch status, known
                        issues, open TODOs, lessons learned. Read this for CURRENT STATE.
docs/
  vault/                Obsidian-compatible knowledge base (open docs/ as vault root). Start at
                        00-Index.md — links to Architecture, Scenarios, ML-Pipeline, Decisions-Log,
                        and dated session Workstreams. This is the most detailed "how did we get
                        here" resource; kept live, not a one-time snapshot.
  *.md                  Longer-form standing docs: LAUNCH_STRATEGY, CALIBRATION_LOG, LICENSING_CHECKLIST,
                        avatar-engine docs (paused subsystem), POSTHOG_GUIDE, MULTIPLAYER_RUNBOOK, etc.
web/                    The shipped React/TS app — THE production runtime
  src/engine/           Authoritative TS sign-verification engine (see §4)
  src/data/signs.ts      Display-only sign text (see §4 — do not confuse with the engine registry)
  src/pages/            LessonPage, PracticePage, StoryPage, DuelPage, RoomPage, SpeedChallengePage,
                        CalibrationPage, AdminPage, etc.
  src/avatar/           3D avatar retargeting engine (paused — see §8)
  src/analytics/        Centralized PostHog wrapper; `track()` in capture.ts is the ONLY sanctioned
                        analytics call site (enforced by a test)
  tests/                Vitest confusor/regression tests
core/, signs/, scenarios/, tools/, tests/  (repo root)
                        The ORIGINAL Python v1 prototype (MediaPipe + OpenCV). Conceptually parallel
                        to web/src/engine/ but NOT what's running in production today.
ml/                     Python ML training pipeline (dataset prep, training, model export to
                        web/public/models/signs/) for the veto-only classifier
supabase/migrations/    Schema — treat as the restorable backup of the DB schema
```

## 6. Current product state (as of 2026-07-21)

- **3 scenarios shipped**: `coffee_shop`, `hospital_shop`, `classroom`.
- **51 signs total** (26 fingerspelled letters + 25 word signs, per current `engine/signs/index.ts`),
  each with confusor tests in the TS engine (Python engine has its own parallel test suite).
- A trained Bi-GRU classifier is live as the veto layer (see §4.8).
- Game mechanics: lessons, practice, story mode, speed challenge, PvP duels (WebRTC), multi-player
  rooms (up to 4), streaks, badges, ranks, a shop, spaced repetition, an admin dashboard with a
  plain-English "Today's Biggest Problem" + "Since Yesterday" overview for non-technical monitoring.
- **Launch status**: pre-launch hardening (analytics, security/perf advisors, kill-switch flags,
  in-app-browser detection banner for Reddit's webview) is done and live in production. A Reddit
  launch post is drafted, fact-checked against the actual codebase, and partially attempted — see
  `docs/REDDIT_LAUNCH.md` for the full launch kit (posts, subreddit research, reply playbook,
  measurement plan) including a HANDOFF section for whoever executes the actual posting.
- **North-star metric for launch is explicitly NOT upvotes** — it's the number of users who complete
  a first lesson and return on Day 2. See `docs/LAUNCH_STRATEGY.md`.

## 7. Real bugs already hit — don't repeat these

- **The COFFEE bug** (§4): single-frame movement checks silently pass static holds. This is *the*
  founding incident behind the whole five-parameter/rolling-window architecture.
- **The WANT/MORE instruction-vs-recognizer mismatch** (fixed 2026-07-20): `data/signs.ts` told users
  to make a "claw" handshape for WANT, but the engine spec required "open" — a user following the
  on-screen instructions failed the recognizer. Root cause was the two-registry split in §4.2 drifting
  apart silently. Fixed by making the engine spec match the (correct) displayed instructions, reusing
  the already-calibrated `clawConfidence` scorer rather than inventing new thresholds.
- **Orphaned signs** (RED, YELLOW, WIN, TEAM): existed in the engine registry with no lesson, world,
  or display entry, making "how many signs do we have?" answer inconsistently (55 vs 51). Deleted.
- **The synthetic-fixture trap**: TEACHER/WRITE/READ passed all automated confusor tests but failed
  live, because their thresholds were calibrated against synthetic ideal-motion fixtures, not real
  human takes. The fix was recording real calibration data and recalibrating — retraining the ML
  model would *not* have fixed this, because the classifier is veto-only and the rule engine was the
  actual gate that was miscalibrated.
- **Fix-discipline rule** (`.claude/rules/fixes.md`): when something fails, the fix must name the
  actual mechanism (not just "the threshold was too low"), must generalize beyond the one failing
  case, and must ship with a regression test on the mechanism — not just a re-confirmation of the one
  site that was failing. This project has been burned by band-aid fixes before; don't repeat that.

## 8. Subsystems that are real but currently paused

- **3D avatar engine** (`web/src/avatar/`, docs under `docs/AVATAR_*`, `docs/ARCHITECTURE.md`,
  `docs/PROJECT_STATUS.md`, `docs/REFERENCE_POSE_SPEC.md`): a from-scratch skeletal retargeting engine
  that poses a 3D avatar to demonstrate signs, built in careful milestones (skeleton discovery →
  calibration → landmark loading → viewers → arm IK retargeting). Currently at Milestone 5 of 9,
  gated — each milestone needs explicit sign-off before the next starts. **Read
  `docs/AVATAR_AUTHORING_HANDOFF.md` before touching this** — it documents three confirmed authoring
  defects with root causes (e.g. reading local-space rest lengths instead of world-space, which flung
  a solved elbow 26m from the shoulder while a self-consistent wrist-position check still read
  0.00mm/PASS). Video-driven retargeting from raw ASL Citizen footage was tried and **explicitly
  rejected** by the user for unacceptable quality — don't re-propose it; the current direction is
  human-posed Blender reference poses + a CC0 mocap archive.
- **Sign demo clips**: currently rendered from the StudioGalt 3D character archive rather than
  webcam/human video, after extensive dataset research ruled out ~10 alternatives (3D-LEX, NVIDIA
  Signs, etc. — see `docs/vault/Workstream-I-Sign-Demo-Clips.md`).

## 9. Where to look for what

| Question | Look here |
|---|---|
| "What's the current infra/launch/analytics state, in brief?" | `PROJECT_MEMORY.md` |
| "How do I add/fix a sign?" | `/new-sign` skill; `docs/CALIBRATION_LOG.md`; `.claude/rules/` |
| "How is the codebase organized, and why?" | `docs/vault/00-Index.md` → `Architecture.md`, `Scenarios.md` |
| "What ML pipeline trained the classifier?" | `docs/vault/ML-Pipeline.md`, `ml/` |
| "What judgment calls were made without asking, and why?" | `docs/vault/Decisions-Log.md` |
| "What's the Reddit launch plan / what's already been posted?" | `docs/REDDIT_LAUNCH.md` |
| "What are the engineering discipline rules I must follow?" | `.claude/rules/*.md` (complexity, modules, information-hiding, error-handling, comments, naming, process, red-flags, no-hardcoding, file-placement, fixes, concurrency/*, systems/*) |
| "What's paused and why?" | §8 above, `docs/AVATAR_AUTHORING_HANDOFF.md`, `docs/VIDEO_RETARGET_HANDOFF.md` |
| "What licensing constraints exist before charging money?" | `docs/LICENSING_CHECKLIST.md` |

## 10. If you're an AI about to make a change here

1. Read `CLAUDE.md` and the relevant `.claude/rules/*.md` files first — they encode real, hard-won
   lessons from this exact project, not generic advice.
2. Check `PROJECT_MEMORY.md` for current state before assuming anything is still true — infra,
   launch status, and known issues change fast.
3. If touching sign recognition, use the `new-sign` skill and never approve a movement-requiring sign
   from a single frame (§4).
4. If touching the avatar engine, read `docs/AVATAR_AUTHORING_HANDOFF.md` first, without exception.
5. If touching anything public-facing (posts, messages, published content), the standing rule from
   this project's owner is: **show the exact final text and get explicit approval before submitting.**
