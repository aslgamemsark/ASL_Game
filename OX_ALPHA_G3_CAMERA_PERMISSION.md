# OX_ALPHA_G3_CAMERA_PERMISSION_MOMENT.md

**Task:** ASL-G3 · `[REPORT]` The camera-permission moment — what a first-time user experiences when
the app needs camera access: timing, context, denial path, and recovery.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `652a419`) ·
**Method:** executed Playwright probe (`web/e2e-adhoc/probe-camera-permission.mjs`) against the
production build across three permission scenarios (granted / denied / prompt), plus targeted DOM
traces of the primer dialog. No code changed.

---

## 1. The two distinct first-camera moments (verified live)

The app has **two different paths to a first camera ask**, and they behave differently:

| Path | Primer shown? | What the user sees |
|---|---|---|
| **Lesson page** (Journey tab → "Start your journey" → lesson node) | ✅ YES — `CameraOnboarding` full-screen dialog (CameraOnboarding.tsx) | "Camera Access Needed" + why (watch hand signs, real-time feedback) + three ✓ privacy bullets (video never leaves device; replay stays local; landmark-coordinates training data with Settings opt-out) + **Allow Camera** primary, **Not now** polite decline, revoke/Privacy footnote. Escape = back out (useDialogA11y wired to onCancel). |
| **Practice Letters / Test from Memory** (Alphabets tab cards) | ❌ NO primer | Native browser permission bar appears cold, with no app-side context; if denied → honest "Camera access denied" card with settings guidance + Try again |

Scenario B measured: after Allow, **live signing view in ~1.3–1.4 s** — no dead wait.

## 2. Denial path (executed: getUserMedia rejecting NotAllowedError)

Both paths land on an honest, actionable card:
> **"Camera access denied"** — "Live coaching needs your camera. Allow camera access in your
> browser settings, then try again." + **Try again** button.

Executed recovery check: once access actually becomes available (stubbed working stream), pressing
**Try again** returns to the live view — verified `recovered=true`. The card never dead-ends the
user; LessonPage additionally keeps Skip available so a cameraless learner can still complete a
lesson's content.

## 3. Findings for the owner (all judgment calls — `[REPORT]`)

**G3-a — the fastest activation funnel skips the privacy primer.** G2 measured the 6-tap guest path
(Alphabets → Practice Letters) reaching a camera ask with zero app-side context: on PracticePage,
the native permission bar is the very first explanation a user gets. The well-crafted
CameraOnboarding primer exists but only fires on the Lesson-page path, which a fresh guest reaches
only via Journey → Start your journey → lesson node. Fix shape if desired: show the same primer
(or a compact variant) before startCam() on PracticePage's expressive entry too. Trade-off: adds
one tap to G2's 6.9 s funnel — owner weighs activation speed vs context.

**G3-b — the primer itself is exemplary** (worth protecting): local-processing reassurance up
front, explicit training-data disclosure with its own opt-out pointer, both accept and decline
affordances, escape hatch, documented iPhone-SE overflow fix. Nothing to change.

**G3-c — "Not now" sets no persistent flag.** It backs out cleanly (verified), but the next lesson
entry re-shows the primer every time until the user once taps Allow Camera. Acceptable (it *is*
required functionality), though a "don't walk me through this again" memory could reduce friction
for deliberate decliners who later return.

## 4. Re-run

`node web/e2e-adhoc/probe-camera-permission.mjs` against any :4173 server of `dist/`
(exit 0 iff all checks pass).
