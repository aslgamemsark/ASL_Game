# ASL_SHIPPING_CHANGELOG.md

## 2026-08-22 — Batch 2 (Round 2: implement → verify → re-audit)

**Branch:** `audit/shipping-readiness` (continued)

### Changes
| ID | Change | Files | Commit |
|---|---|---|---|
| ASL-PERF-002 | Isolate the 10 Hz result publishes to the Sign Coach subtree (`useSyncExternalStore` channel in useRecognition + `LiveSignCoach` wrapper; ClassifierDevPanel subscribes directly). Page trees stop re-rendering 10×/s during signing phases. Rendering delegated to unchanged ParameterChecklist — pixels/gates/aria contract identical. | `useRecognition.ts`, `LiveSignCoach.tsx` (new), `ClassifierDevPanel.tsx`, `LessonPage.tsx`, `PracticePage.tsx`, `StoryPage.tsx` | `24b4dde` |
| ASL-PERF-003 | Adaptive vision tier: `VisionPacer` (engine/visionPacer.ts) tracks the MEDIAN of recent process() costs; sustained median >42 ms past 20-frame warmup ⇒ 28 fps → 20 fps for that loop session (one-way, spike-proof, latest-frame/no-backlog). Capable devices unchanged. 8 unit tests. | `visionPacer.ts` (new), `visionPacer.test.ts` (new), `useRecognition.ts` | `315b286` |
| ASL-TEST-001 | Ad-hoc fake-camera e2e: real production build driven through permission gate → hand-check skip → lesson screen → video frames flowing → zero console errors (Chrome `--use-fake-device-for-media-stream`). Kept out of the canonical suite deliberately. Plus DEV-only `window.__qsVisionPacer` observability. | `playwright.fakecam.adhoc.config.ts`, `e2e-adhoc/*` (new) | `d2cbf0f` |

### Tests / verification (all actually executed)
- `tsc -b` clean · oxlint **0 errors** (30 warnings, all pre-existing) · vitest **743 passed / 9 todo** (57 files, includes 8 new VisionPacer tests)
- Full canonical Playwright suite: **124 passed / 2 skipped** on the pre-Round-2 build; post-Round-2 run **123 passed + 1 CPU-contension timeout** (a11y/WebKit while perf probes ran concurrently — passed in isolation at 22 s, matching the documented contention signature in playwright.config.ts)
- Fake-camera pipeline test: **PASS** (8.2 s)
- Perf probe (ad-hoc, headless Chromium + fake cam):
  - GPU delegation available: median inference **16.9 ms**, tier held at `base`, 251 frames / 12 s ≈ 21 fps effective vision processing (rAF-gated)
  - Software GL (worst case): median inference ~500–650 ms, pacer correctly engaged `low` tier, zero JS errors — demonstrates the downgrade path fires under real measurement, not simulation
- Privacy claim mechanically re-verified: zero `toDataURL/toBlob/captureStream/sendBeacon/upload` paths in src; analytics events carry booleans/reasons only; training samples are numeric landmarks, opt-out-able.

### Performance impact
- Mechanical: up to ~10 page-tree renders/sec removed during every signing phase (was: whole LessonPage/PracticePage/StoryPage tree).
- Mechanical: slow devices drop vision work ~29%/frame-budget (28→20 fps) instead of saturating.
- **NOT DEVICE VALIDATED**: no physical low-end phone measured; all probe numbers are desktop emulation (headless/software-GL or GPU). Absolute device FPS claims remain out of scope until hardware validation.

### Regression risk
Low–medium: PERF-002 touches the publish path of every camera page (mitigated by identical ParameterChecklist rendering + full suites green); PERF-003 defaults to exact historical behavior unless measured slowness occurs.

### Marketing copy drift (P1 from plan): VERIFIED NON-ISSUE against current code
Guest path plays fully without signup; replay recording is opt-in default-off; on-device claims true. No change needed.

---

## 2026-08-22 — Batch 1 (audit + first perf fix)

**Branch:** `audit/shipping-readiness` (from `feat/qs-015-speak-sign-names`; not merged)

### Changes
| ID | Change | Files |
|---|---|---|
| ASL-PERF-001 | Stop per-frame canvas realloc; cap preview redraws at 30 fps; aspect tracking unpaced | `web/src/components/shared/WebcamMirror.tsx` |
| — | Audit deliverables: technical audit, product audit + 78/100 score, phased plan, agent handoff | `ASL_GAME_AUDIT.md`, `ASL_PRODUCT_AUDIT.md`, `ASL_SHIPPING_PLAN.md`, `OX_ALPHA_FINDINGS.md` |

### Tests
- `npx tsc -b --force` clean · vitest **735 passed / 9 todo (56 files)** · `npm run build` OK ·
  oxlint unchanged: 30 warnings / **0 errors** (all pre-existing).
- Live-site regression walkthrough post-change was pre-fix; fix is render-only, verified by
  suite + build. Next live check should re-walk one lesson with a real camera.

### Performance impact
- Removes up to ~90 backing-store allocations+clears/sec and up to 75% of preview draws on
  120 Hz displays during lessons. Device before/after numbers still outstanding (P1 item) —
  no performance claim made beyond the mechanical reduction.

### Regression risk
Low — render-only path, recognition untouched. Aspect-ratio state logic preserved verbatim.

### Baseline recorded (before any change)
- vitest 735/735 green, build OK, lint 30w/0e.
- Live aslgame.vercel.app: onboarding→lesson→denied→skip→complete + landing page, zero console errors.
