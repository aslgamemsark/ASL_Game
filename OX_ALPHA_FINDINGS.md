# OX_ALPHA_FINDINGS.md — Agent Handoff

**Author:** ox-alpha audit session, 2026-08-22
**Branch:** `audit/shipping-readiness` (branched from `feat/qs-015-speak-sign-names`; NOT merged)
**Live site:** https://aslgame.vercel.app/ · **Repo:** `E:\ASL_Game`
**Read this file first if you are a (human or AI) agent continuing this work.**

> **ROUND 2 UPDATE (same day):** P1 items PERF-002 and PERF-003 are now implemented, tested,
> and measured; the Playwright E2E suite has been executed for the first time (124 passed);
> an ad-hoc fake-camera pipeline test exists under `web/e2e-adhoc/`. Shipping score re-scored
> **78 → 86**. Details in `ASL_SHIPPING_CHANGELOG.md` (Batch 2) and `ASL_PRODUCT_AUDIT.md`
> (Round 2 re-score). The remaining path to 90+ is physical-device validation, not code.

---

## 1. THE SINGLE MOST IMPORTANT FINDING

The tasking briefs described the pipeline as:

> MediaPipe → 126 landmarks × 30 frames → WebSocket → FastAPI → LSTM → prediction → frontend

**That architecture does not exist in this codebase.** Verified by repo-wide search
(`fastapi|uvicorn|flask|websocket|ws://` across `.py/.ts/.tsx/.json`, excluding node_modules):
zero hits. `requirements.txt` is mediapipe/opencv/numpy/pytest only.

What actually exists (all client-side):

```
getUserMedia (640x480 ideal, facingMode user)
  ↓
@mediapipe/tasks-vision 0.10.35 — HandLandmarker + PoseLandmarker (VIDEO mode,
  GPU delegate w/ CPU fallback), WASM pinned via MEDIAPIPE_WASM_VERSION
  ↓ engine/capture.ts (app-wide singleton, getSharedCapture)
Frame {t, hands[≤2×21pts], shoulders, mouth} → HandStabilizer → RollingBuffer (2 s)
  ↓ hooks/useRecognition.ts — rAF loop throttled to 28 fps; verify() every tick;
    React publish throttled to 10 Hz; static signs need 2 s hold; movement signs
    need 6 consecutive pass frames after ≥30 warmup frames
  ↓ rule verifier (engine/verifier.ts — port of core/verifier.py; Python is source of truth)
  ↓ PASS → TF.js Bi-GRU classifier VETO-ONLY gate (single inference per pass event,
    not per frame) → onPass/onHint/onAttempt callbacks
  ↓ UI: LessonPage / PracticePage / StoryPage / SpeedChallengePage / DuelPage / RoomPage
Supabase = auth + progress upserts + optional landmark training samples. NEVER video.
Multiplayer signaling = Supabase Realtime channels (not raw WebSockets we manage).
Python prototype (core/, scenarios/) = desktop OpenCV app, source of truth for rules.
```

**Consequence for perf work:** there is no network round-trip in the recognition path.
All latency/CPU budget lives in one browser main thread: 2 MediaPipe models + preview
render + React + (opt-in) MediaRecorder. Any "backend/WebSocket/LSTM" optimization
would be optimizing something that isn't there.

## 2. WHAT I CHANGED (already committed on this branch)

- `b053c1e` perf: WebcamMirror stop per-frame canvas realloc + cap preview redraws at 30 fps.
  Root cause: draw loop reassigned `canvas.width/height` every rAF tick (= backing-store
  alloc + full clear per frame) and drew at raw refresh rate (60–120 Hz phones), competing
  with hand+pose inference on the main thread during lessons. Now: guarded resize (rotation/
  camera-switch only), drawImage paced at 30 fps, aspect tracking left unpaced so overlays
  stay responsive. Recognition path untouched.
  **Verified:** tsc clean · vitest 735 passed/9 todo · build OK · lint unchanged (30 pre-existing warnings, 0 errors).

Nothing else was modified. No redesign, no behavior change intended.

## 3. LIVE-SITE AUDIT (aslgame.vercel.app, headless Chrome, no webcam)

Walked: welcome → guest sign-in → skill pick → Home tabs → "Practice Letters" → LETTER C
lesson screen → camera-denied card → Skip ×5 → Session Complete → back. Plus `/landing.html`.

- **0 console errors / 0 uncaught exceptions** across all of it.
- Camera-denied UX is correct: actionable card ("Allow camera access…"), Try again, Skip — no dead end.
- Skip flow advances prompts correctly and completes with an honest "0 XP earned, 0/5 correct".
- Landing page claims match implementation ("on-device", "camera never leaves your browser" — true).
- CTA chain works: landing CTAs → app root; feedback form is a real Google Form.
- Known limitation of this sweep: headless browser has no camera, so the *recognition-active*
  path was validated statically/by code-read, not live. `browser_snapshot` timed out once right
  after entering Home (likely animation-heavy DOM); JS eval worked fine throughout.

## 4. KEY CODE FACTS THE NEXT AGENT NEEDS (with receipts)

- Recognition loop throttle: 28 fps (`MIN_FRAME_INTERVAL_MS`, useRecognition.ts ~line 241);
  React result publish 10 Hz (~line 256). These were already fixed in earlier audits — do not
  "re-fix".
- `setResult(vr)` publishes a fresh object at 10 Hz → every consumer re-renders 10×/s while a
  lesson runs. ParameterChecklist has React.memo (2026-07-30); most other components do not.
- LessonPage.tsx line ~182: effect with NO dependency array runs after every render
  (incl. those 10 Hz updates). Guarded internally by `loopStartedForSign`, so cost is small
  but nonzero. Deliberate P2, do not casually add deps (startLoop identity churn risk).
- Attempt replay recorder (useAttemptRecorder): opt-in (`signup-replay-enabled`), continuous
  MediaRecorder segments of 30 s when enabled — a real extra encoder load when on; default off.
- useCamera constraints: `facingMode:'user', width ideal 640, height ideal 480`, no explicit
  frameRate; stall detection 6 s; mute/unmute + visibilitychange handling present (iOS bg fix).
- Classifier loads lazily per camera page; tfjs chunk is 1082 kB minified / 272 kB gzip but
  code-split out of the main bundle.
- Build: Vite 8 (rolldown), PWA precache 52 entries ≈ 1782 kB. Main chunks: index 215 kB,
  react 185 kB, supabase 202 kB, posthog 220 kB, mediapipe 136 kB (gzip figures in build log).
- Tests: vitest include pattern `['tests/**/*.ts', 'src/**/tests/**/*.test.{ts,tsx}']`,
  56 files / 735 tests green pre- and post-change. Playwright e2e specs exist under web/e2e
  (not run in this session — need browsers installed; `npm run test:e2e`).

## 5. PRIORITIZED REMAINING WORK (evidence-ranked, no redesign)

### ROUND 2 STATUS: items 2 and 3 below are DONE (see changelog Batch 2). Item 1 is the only thing between the product and a 90+ score.

### P1 — should fix before pushing hard on acquisition
1. **Measure before/after of b053c1e + PERF-002/003 on a real low-end Android** (or CPU-throttled DevTools: 4× slowdown, 480p fake cam). Acceptance: preview stays ≥ ~24 fps visually, processed FPS holds near 28 (base tier) or degrades gracefully via `low` tier, no long tasks >50 ms bursts from rendering. Until then the perf claim is "root-caused + logically sound + emulation-probed", NOT device-measured. (Rule: no fake perf claims.) A DEV-mode probe harness now exists: `window.__qsVisionPacer` + `web/e2e-adhoc/perf-probe.mjs`.

### P2 — polish/reliability (from code read; each needs its own repro first)
- LessonPage dep-array-less effect (above) — make intent explicit.
- oxlint's 30 warnings (mostly exhaustive-deps in DuelPage/RoomPage timers) — triage, don't blanket-fix.
- Consider `requestVideoFrameCallback` where available to drive preview draws instead of rAF
  (draws exactly once per new frame, idles otherwise).
- Landing page: hero says "Free, no signup" while app shows a save-progress auth modal mid-
  onboarding — copy already reconciled per App.tsx comment, but re-verify funnel copy once more.

### P3 — future
- Per-user calibration (already on roadmap README).
- FaceLandmarker/NMM path is wired but unused by current signs (cost only if opted in).

## 6. THINGS THAT ARE GOOD — DO NOT TOUCH

- Rule-verifier + veto-only ML gate architecture (and the COFFEE single-frame regression lock).
- Shared Capture singleton + failure-cache-clear retry semantics (getSharedCapture).
- Camera stall/mute/visibility handling (real PostHog-driven fixes, documented inline).
- Framing thresholds calibrated against 27k real frames (see computeFraming comments) —
  someone removed a rule that fired on 77% of good frames. Trust the data comments.
- The inline-comment discipline explaining WHY everywhere. Preserve it when editing.
- Python core as recognition source of truth; changes must land in Python first, then port.

## 7. PROCESS NOTES FOR THE NEXT AGENT

- Project convention: work happens on feature branches; `main` auto-deploys to Vercel prod.
  Do not merge without the owner. This branch = docs + one perf commit.
- Read CLAUDE.md + docs/WORKLOG.md conventions; append to WORKLOG when you land work.
- Run before claiming done: `npx tsc -b --force && npx vitest run && npm run build` in `web/`.
- The user's #1 stated fear: "don't completely change my code." Bias toward surgical patches
  with root-cause comments, matching the existing style.

## 8. OPEN QUESTIONS FOR THE OWNER

1. Physical low-end Android available for a 10-minute measurement session? (Unlocks honest
   before/after numbers for the WebcamMirror change + tiering work.)
2. Is the attempt-replay feature (MediaRecorder) worth auto-enabling post-fix, or keep opt-in?
3. Target devices floor? (e.g. "must hold 20 processed fps on a 4-year-old ₹10k Android".)
