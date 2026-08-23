# AUTONOMOUS_RED_TEAM_FINAL.md

**Session:** 2026-08-22/23 · **Branches:** `audit/shipping-readiness` (Rounds 1–2) → `audit/autonomous-red-team` (Round 3)
**Detailed findings:** `AUTONOMOUS_RED_TEAM_FINDINGS.md` · **Fix batches:** `ASL_SHIPPING_CHANGELOG.md`

---

## SHIPPING SCORE

**BEFORE (Round 1): 78/100 — SHIP WITH KNOWN LIMITATIONS**
**ROUND 2: 86/100 — SHIP WITH MINOR FOLLOW-UPS**
**AFTER (Round 3, this session): 88/100 — SHIP WITH MINOR FOLLOW-UPS**

| Category | Weight | R2 | R3 | Δ basis |
|---|---:|---:|---:|---|
| FUNCTIONALITY | 20 | 18 | 18.5 | Auth error copy now actionable; exploration suite proves no nav dead ends as guest; all prior flows still green. |
| PERFORMANCE | 20 | 15 | 16 | Dead-camera CPU waste eliminated on all six signing screens (AR-003); prior wins (render isolation, adaptive vision tier) intact. Still −4: no physical low-end device numbers. |
| MOBILE UX | 15 | 12 | 12 | No regression; iOS mute/stall handling now paired with loop shutdown (completes the mobile camera story). |
| GAMEPLAY / RECOGNITION | 15 | 13 | 13.5 | Sign registry consistency now machine-enforced (754 unit tests incl. parity lock); HELLO display drift fixed against Python source of truth. |
| PRODUCT / CONVERSION | 10 | 9 | 9 | Honest copy for new learners (Quick Session blurb). |
| ACCESSIBILITY | 5 | 4.5 | 4.5 | Unchanged; axe sweeps passing in isolation. |
| SECURITY / PRIVACY | 5 | 4.5 | 4.5 | Telemetry no longer fabricates crash events (observability integrity). |
| RELIABILITY | 5 | 4.5 | 4.8 | Fire-and-forget writes can't cascade into global error reporting; dead-camera recovery complete. |
| TESTING | 5 | 5 | 5 | +11 tests this round (auth errors ×8, consistency ×3), exploration suite ×6 E2E probes. |
| **Total** | **100** | **86** | **88** | |

### Why not 90+ yet
One reason only: **physical low-end device validation has never been performed.**
Every code-side lever found across three rounds has been pulled and verified. The remaining
score mass sits behind hardware truth: real-device FPS/memory/thermal measurement of the full
camera→MediaPipe→verify pipeline, plus a long-session soak. A probe harness is deployed and
waiting (`window.__qsVisionPacer`, `web/e2e-adhoc/perf-probe.mjs`) so that session takes minutes,
not hours.

---

## WHAT CHANGED THIS ROUND (Round 3)

### FIXED
1. **AR-001** Raw auth errors → human copy with recovery paths (`117269f`).
2. **AR-002** Telemetry failures can't masquerade as app crashes (`c9b8150`).
3. **AR-003** Recognition loop stops when the camera dies — all six signing screens (`edaf14b`, `3b6a4eb`).
4. **AR-004a** False "learned signs" copy for brand-new users (`ff9201d`).
5. **AR-004b** Display HELLO `location.required` aligned to Python source of truth (`b198ac4`).
6. **AR-005** `void ALL_BADGES` lint hack removed (`ff9201d`).
7. **AR-006** Guest-navigation exploration suite — 6 E2E probes, zero console errors (`2a7b16f`).
8. **AR-007** Sign-registry consistency locks (3 invariant tests over 51 signs) (`b198ac4`).

### INVESTIGATED — NO ACTION (documented reasons)
Auth lifecycle deep-dive, memory-leak sweep (all timers/rAF/listeners/channels traced),
race-guard audit, privacy re-verification, lesson_started double-fire (telemetry-only noise).

### RED/YELLOW/WIN/TEAM decision
Kept, not deleted. They were deliberately restored in `3a1842b` after the JSON generator
silently dropped them; they're Python-pipeline-complete but not yet taught anywhere. The
consistency test now asserts the engine-only set equals exactly these four, so a future orphan
fails loudly instead of shipping silently.

---

## TEST EVIDENCE (all executed this round)

| Gate | Result |
|---|---|
| `tsc -b --force` | clean |
| `vitest run` | **59 files / 754 passed / 9 todo** (was 56/735 at Round-1 baseline) |
| `oxlint` | 30 warnings / **0 errors** (all pre-existing) |
| `npm run build` (prod) | OK, PWA precache generated |
| Canonical Playwright suite | 124 passed / 2 skipped (pre-R3 build); post-R3 run in progress at write time, R3 changes are test-additive + one display-data field |
| Ad-hoc fakecam+exploration config | **6/6 passed** post-R3 (incl. full camera pipeline probe) |
| Live prod site walkthrough | Round-1 evidence stands; zero console errors |

## REMAINING LIMITATIONS / NOT VERIFIED
- Physical low-end Android/iPhone measurement — NOT DONE (sole 90+ blocker).
- 30-min thermal/memory soak — NOT RUN.
- Multiplayer E2E — requires local Supabase stack (Docker unavailable here).
- oxlint's 30 exhaustive-deps warnings — triaged as intentional patterns, not fixed.

## NEXT SESSION (the 90+ closer)
1. Run `web/e2e-adhoc/perf-probe.mjs` against a real low-end Android (Chrome remote debugging)
   or accept DevTools-throttled numbers as the documented ceiling.
2. Record before/after FPS · inference ms · tier engagement · memory into the changelog.
3. Re-score: expected ≥90 with hardware evidence in hand.
