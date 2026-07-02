# ASL_Game — Project Primer (read this first, every session)

We're building a **gamified ASL learning app** with two developers, **scenario by scenario**.
Saad owns the coffee-shop scenario; a teammate owns another scenario.

## ARCHITECTURE DECISIONS ALREADY MADE — do not relitigate

- **Runtime: Python prototype now, port to TypeScript/browser later.** v1 runs locally with
  MediaPipe (**Tasks API**) + OpenCV + numpy. We deliberately use the Tasks API (not the legacy
  Solutions API) so concepts line up with `@mediapipe/tasks-vision` when recognition is ported
  to the browser later. Recognition is local/client-side by design — no video or landmark
  streaming to a server for recognition (latency + cloud cost).
- **v1 sign recognition is RULE-BASED MATH; the trained ML model (Phase C) is a disambiguation
  LAYER on top — it does not replace the rule engine or the per-parameter Sign Coach.**
  Training datasets: **ASL Citizen** (licensed) and **WLASL** (authorized 2026-06-30 by owner
  decision — supersedes the earlier "no WLASL" rule).
  ⚠️ LICENSING CAVEAT: WLASL has non-commercial / research-oriented licensing and a history of
  source-video takedowns. It is fine for model training and experiments, but **verify WLASL's
  license terms before any COMMERCIAL release** of a model trained on it. We still do NOT use
  ASLLVD. Keep collecting our own landmark recordings — that remains our proprietary set.
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
  `hospital_shop/` = teammate.
- `core/game.py` — shared game mechanics (PiP webcam, score HUD, success flash, prompt banner).
- `tools/` — landmark fixture recorder. `tests/` — confusor regression tests.

## CURRENT STATUS

Coffee-shop scenario in progress. First sign: **COFFEE** (dominant S-hand circling over a
stationary non-dominant S-hand). Static control: fingerspelled **letter A**.

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
