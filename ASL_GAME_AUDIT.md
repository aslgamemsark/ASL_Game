# ASL_GAME_AUDIT.md — Technical / Performance Audit

**Date:** 2026-08-22 · **Branch:** `audit/shipping-readiness` · **Auditor:** ox-alpha session
**Companion docs:** `ASL_PRODUCT_AUDIT.md` (product + shipping score) · `ASL_SHIPPING_PLAN.md` (fix plan) · `OX_ALPHA_FINDINGS.md` (agent handoff)

---

## A. Current Architecture (as it actually exists — verified, not assumed)

The commonly-assumed `MediaPipe → WebSocket → FastAPI → LSTM` pipeline **does not exist**.
Recognition is 100% client-side by explicit design decision (CLAUDE.md: "Recognition is
local/client-side by design — no video or landmark streaming to a server for recognition").

```
Camera (getUserMedia, 640×480 ideal, facingMode 'user', no explicit frameRate)
   ↓  hooks/useCamera.ts — stall detection (6s), track mute/unmute, visibilitychange recovery,
   ↓  remote kill switch (disable_camera)
@mediapipe/tasks-vision 0.10.35 (WASM version-pinned, GPU delegate → CPU fallback)
   HandLandmarker (2 hands) + PoseLandmarker (lite) [+ FaceLandmarker only if opted]
   ↓  engine/capture.ts — process(video, ts) both models per call; app-wide singleton
Frame {t, hands[≤2][21], leftShoulder, rightShoulder, mouth}
   ↓ HandStabilizer (0.3s dropout bridge) → RollingBuffer (2.0s window)
hooks/useRecognition.ts rAF loop:
   • MediaPipe capped at 28 fps (MIN_FRAME_INTERVAL_MS)
   • verify() every processed frame (rule engine over rolling window)
   • React publish throttled to 10 Hz (result) / dedupe-by-message (framing)
   • PASS = all required params clear threshold; static signs need 2s continuous hold,
     movement signs need 6 consecutive pass frames after ≥30-frame warmup
   ↓ rule verifier engine/verifier.ts (port of core/verifier.py — Python is source of truth)
   ↓ gate.ts: TF.js Bi-GRU classifier VETO-ONLY (single inference per pass event, never per frame;
     fail-open to rules-only on any error; letters excluded — model wasn't trained on them)
   ↓ callbacks onPass/onHint/onVerified/onAttempt
UI pages (Lesson/Practice/Story/SpeedChallenge/Duel/Room) ← Zustand store (persist → localStorage)
Supabase: auth, progress upsert (debounced 3s), optional landmark training samples (opt-out),
Realtime channels for multiplayer signaling/challenges. Video NEVER leaves the device.
Python prototype (core/, signs/, scenarios/, pytest confusor fixtures) = desktop twin + rule source of truth.
```

### Measured / derived performance profile

| Stage | Rate | Evidence |
|---|---|---|
| Camera capture | device-dependent, typically 30 fps | constraints request resolution only |
| MediaPipe processing | ≤ 28 fps (rAF-gated) | `useRecognition.ts` MIN_FRAME_INTERVAL_MS |
| verify() | every processed frame (~28/s) | same tick |
| React state publishes | result 10 Hz · framing on-change only | RESULT_UPDATE_INTERVAL_MS |
| Preview render (pre-fix) | raw refresh rate 60–120 Hz **+ per-frame canvas realloc** | WebcamMirror draw loop |
| Preview render (post-fix, b053c1e) | 30 fps, resize-on-change only | WebcamMirror.tsx |
| Classifier inference | once per rule-pass event only | useRecognition firePass |
| Network in recognition path | none | architecture |

**Effective recognition latency budget** (same-thread serial): frame wait (≤36 ms) +
hand detect + pose detect (device-dependent, ~10–40 ms desktop-class) + verify (<1–2 ms) +
debounce floors (static: 2000 ms hold; movement: ≥6 pass frames ≈ 215 ms + buffer warmup).
Perceived responsiveness is dominated by the deliberate debounce floors, not compute.

## B. Findings

Each item: ID · AREA · SEVERITY · CURRENT · ROOT CAUSE · EVIDENCE · FIX · IMPACT · RISK · TEST.

---

**ASL-PERF-001 · CAMERA/RENDER · HIGH (P1)**
Current: preview drew at display refresh rate and reassigned canvas.width/height every tick.
Root cause: unconditional canvas dimension assignment resets the backing store each frame;
draw loop unthrottled.
Evidence: WebcamMirror.tsx pre-fix draw loop (commit b053c1e diff); user reports of laggy
camera during gameplay on weak phones.
Fix: **DONE** — guarded resize + 30 fps draw cap (recognition untouched).
Impact: removes up to ~90 alloc+clear ops/sec and up to 75% of draws on 120 Hz phones.
Risk: low (render-only). Test: tsc/vitest/build green; visual parity on live flows.

**ASL-PERF-002 · REACT · MEDIUM**
Current: `setResult(vr)` publishes a fresh object at 10 Hz; consumers without memo re-render
10×/s during signing phases.
Root cause: verify() returns new object references; memoization coverage partial
(ParameterChecklist memoized 2026-07-30; broader tree not).
Evidence: useRecognition.ts throttle comment ("no React.memo anywhere" historically);
component grep.
Fix (planned): React.memo on hot-path subtrees; keep 10 Hz publish.
Impact: fewer wasted renders on low-end CPUs. Risk: low. Test: React Profiler before/after.

**ASL-PERF-003 · VISION SCHEDULING · MEDIUM**
Current: fixed 28 fps vision rate regardless of device capability.
Root cause: static constant chosen as a safe global compromise.
Evidence: MIN_FRAME_INTERVAL_MS constant; no runtime adaptation.
Fix (planned): measured adaptive tiering (e.g., sustain-check → 20/15 fps tier; pose-model
skip where safe) behind a config, driven by observed tick cost — NOT UA sniffing.
Impact: keeps weak devices out of thermal death-spiral. Risk: medium (accuracy coupling);
requires before/after accuracy check via confusor fixtures + live attempts.

**ASL-PERF-004 · ENCODER · LOW-MEDIUM**
Current: opt-in replay (`signup-replay-enabled`) runs continuous MediaRecorder segments
(30 s) alongside two models when enabled.
Root cause: feature adds a hardware encoder to the same frame budget.
Evidence: useAttemptRecorder.ts SEGMENT_MS design comment.
Fix (planned): document load; consider auto-lower preview tier while recording; keep opt-in.
Risk: low. Test: manual on throttled CPU with replay on/off.

**ASL-ARCH-001 · ARCHITECTURE · INFO**
Current: entire rule engine duplicated Python↔TS (documented risk in ARCHITECTURE.md §6.2).
Fix: follow existing REFACTORING_PLAN.md (shared JSON sign definitions). Out of scope here.

**ASL-REACT-001 · EFFECTS · LOW**
Current: LessonPage effect without dependency array runs after every render (incl. 10 Hz
updates); internally guarded by loopStartedForSign so it's cheap-but-not-free.
Fix (planned): make intent explicit with correct deps or an interval-free design.
Risk: medium if done carelessly (startLoop identity) — needs its own focused change.

**ASL-MOBILE-001 · CAMERA UX · LOW**
Current: getUserMedia requests no explicit frameRate; some Android cameras may deliver
30 fps at higher encoder cost than needed.
Fix (optional): `frameRate: { ideal: 30, max: 30 }` after measurement — do not blind-tune.

**ASL-TEST-001 · TESTING · MEDIUM**
Current: 735 vitest tests green; Playwright e2e specs exist but weren't executed this
session; production-config e2e exists (playwright.prod.config.ts).
Fix (planned): run e2e locally with fake-media camera flags; wire into routine checks.

## C. Performance Plan (ranked)

| Optimization | Impact | Confidence | Difficulty | Risk |
|---|---:|---:|---:|---:|
| ~~Canvas realloc + draw-rate fix (WebcamMirror)~~ **done** | High | High | Low | Low |
| React.memo hot subtrees | Medium | High | Low | Low |
| Adaptive vision tiers (measured) | High | Medium | Medium | Medium |
| rVFC-driven preview draws | Low-Med | Medium | Low | Low |
| Move inference to Worker/WASM-thread | Unknown | Low | Very High | High — **not recommended now**: MediaPipe Tasks already offloads to WASM/GPU; worker would force video plumbing for marginal gain. Revisit only with long-task profiling evidence. |
| Reduce camera resolution further | Medium | Medium | Low | Med — risks landmark quality; measure first |

## D. UX Plan (preserve identity)

1. Keep current onboarding (already short: welcome → guest/skip → skill pick).
2. Add a one-line status chip during model warm-up ("loading recognizer…" exists — ensure it
   shows on slow networks rather than a frozen button).
3. Recognition feedback: existing ParameterChecklist is the differentiator — keep; improve
   perceived latency by surfacing hold-progress earlier on static signs.
4. Camera-denied card is already actionable — keep pattern for all error states.
5. Copy consistency sweep: "sign/gesture", "practice/review" terminology.

## E. UI Plan (polish only)

1. Consistent focus rings on all tappable rows (a11y + polish).
2. Touch-target audit: letter grid buttons ≥44 px effective (they're aspect-square cards — OK),
   header close buttons verify ≥44 px hit area on phones.
3. Loading skeletons for Leaderboard/Friends lists instead of blank space.
4. No redesign items — the z-* token system, Zippy mascot, and layout are coherent and shipped.

## F. What was intentionally NOT changed

- Rule engine math, thresholds, debounces (calibrated against real data; see inline comments).
- 28 fps vision / 10 Hz publish rates (already tuned by prior audits with evidence).
- Store structure, Supabase schema, multiplayer signaling, PWA setup.
- Any visual identity.
