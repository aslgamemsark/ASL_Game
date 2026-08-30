# ASL_Game — Project Primer (read this first, every session)

We're building a **gamified ASL learning app** with two developers, **scenario by scenario**.
Saad owns the coffee-shop scenario; a teammate owns another scenario.

## Software design rules
This project follows Ousterhout-derived software design principles — binding
design guidance, not optional style notes. Rules are split by topic under
.claude/rules/:

*At the start of every session, read all rule files before writing any code.*
Apply them wherever they are relevant to production code — not mechanically
everywhere, but wherever the rule genuinely improves the design. These rules
exist to prevent the specific failure modes listed in each file; treat a
violation as a design signal, not a style note.

*Design principles* (Ousterhout-derived):
- .claude/rules/complexity.md
- .claude/rules/modules.md
- .claude/rules/information-hiding.md
- .claude/rules/error-handling.md
- .claude/rules/comments.md
- .claude/rules/naming.md
- .claude/rules/process.md
- .claude/rules/red-flags.md
- .claude/rules/no-hardcoding.md
- .claude/rules/file-placement.md
- .claude/rules/fixes.md
- .claude/rules/worklog.md

*Start every session by reading `docs/WORKLOG.md`* — the running record of what changed and why,
updated continuously as work lands (not at session end, which is when context runs out and the
record is lost). See `.claude/rules/worklog.md` for the format and when to compress it.

*Concurrency and timing bugs:*
- .claude/rules/concurrency/race-conditions.md
- .claude/rules/concurrency/toctou.md
- .claude/rules/concurrency/deadlock.md
- .claude/rules/concurrency/livelock.md
- .claude/rules/concurrency/starvation.md
- .claude/rules/concurrency/order-violations.md
- .claude/rules/concurrency/fire-and-forget-tasks.md
- .claude/rules/concurrency/resource-cleanup.md
- .claude/rules/concurrency/event-ordering-assumptions.md
- .claude/rules/concurrency/testing-concurrency-bugs.md

*Systems and OS-level bugs:*
- .claude/rules/systems/memory-safety.md
- .claude/rules/systems/resource-limits.md
- .claude/rules/systems/process-signals.md
- .claude/rules/systems/filesystem-issues.md
- .claude/rules/systems/networking.md
- .claude/rules/systems/numeric-issues.md
- .claude/rules/systems/time-date-handling.md
- .claude/rules/systems/silent-error-handling.md
- .claude/rules/systems/internationalization-encoding.md

## ARCHITECTURE DECISIONS ALREADY MADE — do not relitigate

- **Runtime: the port already happened — `web/src/engine/` (TypeScript) is what ships in
  production today.** This bullet used to read "Python prototype now, port to TypeScript/browser
  later," written before that port shipped and never updated (corrected 2026-08-30; see
  `docs/AI_ONBOARDING.md` §3, and AGENTS.md's identical correction). The Python
  `core/`/`signs/`/`scenarios/` prototype (MediaPipe Tasks API + OpenCV + numpy) is still live for
  ML training and reference — the deliberate use of the Tasks API (not the legacy Solutions API)
  is exactly why the two stayed conceptually portable — but a live recognition bug belongs in
  `web/src/engine/`, not here. Recognition is local/client-side by design either way — no video or
  landmark streaming to a server for recognition (latency + cloud cost).
- **v1 sign recognition is RULE-BASED MATH; the trained ML model (Phase C) is a disambiguation
  LAYER on top — it does not replace the rule engine or the per-parameter Sign Coach.**
  Training datasets: **ASL Citizen** (licensed) and **WLASL** (authorized 2026-06-30 by owner
  decision — supersedes the earlier "no WLASL" rule).
  ⚠️ LICENSING CAVEAT: WLASL has non-commercial / research-oriented licensing and a history of
  source-video takedowns. It is fine for model training and experiments, but **verify WLASL's
  license terms before any COMMERCIAL release** of a model trained on it. We still do NOT use
  ASLLVD. Keep collecting our own landmark recordings — that remains our proprietary set.
  See `docs/LICENSING_CHECKLIST.md` for the full pre-commercial-release checklist (datasets,
  the ybot avatar rig, reference clips, model files, npm dependencies) — work through it before
  charging money for the app, not before.
- **Stack (v1):** Python, MediaPipe Hand + Pose (Tasks API), OpenCV (game UI + webcam), numpy
  (geometry). Future: React + TypeScript frontend, Supabase/Postgres for user progress — NOT
  for sign recognition.

## NON-NEGOTIABLE RULE — we already shipped a bug from violating this once

Every ASL sign is defined by five parameters: **handshape, location, movement, palm
orientation, non-manual markers**. A sign verifier must **NEVER** approve a match using only a
single video frame when the sign's definition requires movement. Movement (circular, linear,
repeated) must be validated by analyzing a **ROLLING WINDOW of frames (~1.5–2 seconds)**, not
the current frame alone.

Concretely: our old COFFEE checker only checked "two fists, roughly the right distance apart"
on one frame, and falsely passed when the user held two static fists with no motion — COFFEE
actually requires the dominant hand to circle over the non-dominant fist. Do not repeat this
class of bug for any new sign.

## ARCHITECTURE PATTERN we use to prevent repeats

1. **Sign Definition Schema** (`core/schema.py`; definitions in `signs/`) — every sign is
   declared as data: required handshape(s) per hand, spatial relationship between hands,
   movement type (none/linear/circular/repeated) with thresholds, palm orientation, NMMs.
2. **Generic verifier engine** (`core/verifier.py`) — one function reads the rolling landmark
   buffer + a sign definition and returns a confidence score **per parameter**. Overall pass
   requires **every** parameter marked "required" to individually clear its threshold —
   **never** an averaged score.
3. **Confusor test suite** (`tests/`) — every sign ships with a fixture of the correct sign AND
   a fixture of the likeliest accidental false positive, both replayed through the verifier as
   automated tests.
4. **Dev-only debug overlay** (`core/overlay.py`) — live per-parameter scores on screen.

All spatial thresholds are expressed as **ratios of shoulder width** (from pose landmarks),
never raw pixels, so the system works regardless of how close the user sits to the camera.

## REPO LAYOUT (and why)

- `core/` — **SHARED recognition engine** (capture, schema, verifier, movement, orientation).
  Theme-agnostic. Must **never** be duplicated per scenario — divergent per-scenario logic is
  exactly how the COFFEE bug got in.
- `signs/` — shared sign definitions (pure data).
- `scenarios/<name>/` — each developer's workspace; owns **only** its presentation/theme
  (background, prompts, success animation) plus a thin `main.py`. `coffee_shop/` = Saad,
  `hospital_shop/` = teammate. `classroom/` was added 2026-07-03 (ownership not yet assigned).
- `core/game.py` — shared game mechanics (PiP webcam, score HUD, success flash, prompt banner).
- `tools/` — landmark fixture recorder. `tests/` — confusor regression tests.

## CURRENT STATUS

Three scenarios exist: `coffee_shop`, `hospital_shop`, and `classroom` (added 2026-07-03).
24 signs total (7 fingerspelled letters + word signs) across all three, each with confusor
tests in both the Python and TypeScript engines. A trained Bi-GRU ML classifier
(`web/public/models/signs/`) runs as a veto-only disambiguation layer alongside the rule
verifier — see `docs/vault/00-Index.md` (an Obsidian-compatible notes vault, open `docs/` as
the vault root) for a fuller map of what exists and why, kept updated as work lands.

## WHEN ASKED TO ADD OR FIX A SIGN

Follow the pattern above. If anyone describes a check that only looks at handshape and location
for a sign that involves movement, **push back** and ask for the movement spec before writing
the check.

## AVATAR ENGINE — MANDATORY READING BEFORE TOUCHING IT

The 3D avatar work lives on branch `claude/avatar-lab-prototype` (module `web/src/avatar/`).
**Before authoring sign animations, finger curls, or changing the animation path, read
`docs/AVATAR_AUTHORING_HANDOFF.md`** — it records verified rig conventions, three confirmed
authoring defects with root causes and prescribed fixes, and the rules that stopped earlier
models from shipping broken poses (FK readback before every write; measure the rig, never assume
axis conventions; Blender keyframes from the user outrank code-authored math).

**Active effort (approved 2026-07-02): video-driven arm retargeting from ASL Citizen.** Plan,
research findings, per-sign risks, and current implementation state are in
`docs/VIDEO_RETARGET_HANDOFF.md` — read it before touching this pipeline. Pilot signs (must
work): HELLO, YOU, COFFEE, WANT, HOSPITAL.
