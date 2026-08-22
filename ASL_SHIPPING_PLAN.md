# ASL_SHIPPING_PLAN.md — Prioritized Fix Plan

**Date:** 2026-08-22 · **Branch:** `audit/shipping-readiness`
Rule: every item is surgical, preserves existing behavior/identity, and lands with a
regression test where practical. Python rule engine stays source of truth; nothing here
changes recognition semantics.

---

## PHASE 1 — CRITICAL BUGS

**None open.** No P0 found in code or on the live site (walkthrough evidence in
ASL_PRODUCT_AUDIT.md). If one is reported later, use the reproduce→isolate→fix→regression-test
loop before touching anything else.

## PHASE 2 — CAMERA / GAMEPLAY PERFORMANCE

### ASL-PERF-001 ✅ DONE (commit b053c1e)
Severity: P1 · Location: `web/src/components/shared/WebcamMirror.tsx`
Problem: camera preview lag during gameplay, worst on high-refresh/low-end phones.
Root cause: draw loop reassigned canvas.width/height every rAF tick (backing-store alloc +
full clear per frame) and drew at raw display refresh rate (60–120 Hz), competing with two
MediaPipe models on the main thread.
Fix: resize only on real dimension change; pace drawImage to 30 fps; aspect tracking unpaced.
Acceptance criteria:
- [x] tsc clean, vitest 735 passed, build OK, lint unchanged
- [ ] measured on low-end Android or 4–6× CPU-throttled DevTools: preview ≥ ~24 visual fps,
      processed FPS ≈ 28 sustained, no render-caused long-task bursts *(outstanding — needs device)*

### ASL-PERF-002 — React.memo hot subtrees
Severity: P1 · Complexity: Low · Risk: Low · Deps: none
Problem: fresh `result` object at 10 Hz re-renders unmemoized consumers all lesson long.
Fix: memo LessonHeader/hint chips/coaching panels that take primitive-or-stable props;
do NOT memo components relying on object-literal props without stabilizing them first.
Acceptance: React Profiler shows signing-phase commits limited to checklist + page shell;
all tests green.

### ASL-PERF-003 — Adaptive vision tiers (measured)
Severity: P1 · Complexity: Medium · Risk: Medium (accuracy-coupled) · Deps: PERF-001 measurement
Design: rolling median of tick cost → tier switch (T1: current 28 fps both models;
T2: 20 fps; T3: 20 fps + pose skip where the active sign allows). Hysteresis + one-way
downgrade per session + user-visible nothing. Confusor fixtures must pass identically on T1.
Acceptance: on throttled CPU, tiering engages before frame drops hit preview; accuracy
fixtures unchanged at T1.

### ASL-PERF-004 — rVFC-driven preview draws (optional)
Severity: P2 · Complexity: Low · Risk: Low
Use requestVideoFrameCallback when available to draw exactly once per new frame (≤30 fps cap),
rAF fallback otherwise. Acceptance: no visual change; fewer draws on cameras delivering <30 fps.

## PHASE 3 — MOBILE / LOW-END DEVICES
Covered by PERF-001 measurement + PERF-003. Additionally:
### ASL-MOBILE-002 — Device matrix run
Severity: P1 · Complexity: Medium (logistics) · Risk: none
Matrix (mark PASS only with evidence): Desktop Chrome/Edge/Firefox · Android Chrome (low/mid/
high) · iPhone Safari · networks {fast, slow 3G throttle, offline} · camera {allowed, denied,
unavailable} · orientation {portrait, landscape}. Record in ASL_FINAL_SHIPPING_REPORT.md.
Physical devices unavailable ⇒ DevTools CPU 4×/6× + fake-camera e2e, documented as emulation.

## PHASE 4 — UX
### ASL-UX-002 — Warm-up visibility on slow networks
Severity: P2 · Problem: model warm-up can look like a frozen button. Fix: ensure the loading
line ("cameraLoading" Zippy line) persists until recognition ready on ALL camera pages.
### ASL-UX-003 — Copy consistency sweep
Severity: P2 · "sign/gesture", "practice/review", "lesson/session" — one term per concept.

## PHASE 5 — UI POLISH
### ASL-UI-002 — Focus rings + hit-area sweep (P2)
### ASL-UI-003 — Skeletons for Leaderboard/Friends lists (P2)

## PHASE 6 — MARKETING
### ASL-MKT-002 — Funnel copy drift (P1, tiny): reconcile landing hero trust chips with the
actual auth-modal flow; keep honest claims, remove ambiguity.
### ASL-MKT-003 — Real gameplay capture for OG image/video (P3, needs owner).

## PHASE 7 — ACCESSIBILITY
### ASL-A11Y-002 — Routine axe e2e (P1): the @axe-core/playwright dep exists; wire a11y.spec
into default e2e run and fix violations it reports.

## PHASE 8 — SECURITY / RELIABILITY
### ASL-SEC-002 — Re-verify live RLS policies once against supabase/migrations (P2).
No client secrets found; camera privacy claim verified true; kill switches present.

## PHASE 9 — TESTING
### ASL-TEST-002 — Run full Playwright suite locally incl. fake-device camera (P1).
### ASL-TEST-003 — Regression test for WebcamMirror sizing guard (unit-testable via ref
mock asserting width set once across frames) (P2).

## PHASE 10 — FINAL SHIPPING AUDIT
Re-score ASL_PRODUCT_AUDIT.md table after each phase lands; produce
ASL_FINAL_SHIPPING_REPORT.md with BEFORE 78 → AFTER score, fixed vs remaining, device results,
and a single SHIP / SHIP WITH KNOWN LIMITATIONS / DO NOT SHIP decision.
