# ASL_PRODUCT_AUDIT.md — Product & Shipping Readiness

**Date:** 2026-08-22 · **Branch:** `audit/shipping-readiness` · **Auditor:** ox-alpha session
**Round 2 re-score below — Round 1 (78/100) and full A–U detail preserved further down.**

---

## ROUND 2 RE-SCORE (post implementation)

# Overall: 86 / 100  (was 78)

| Category | Weight | R1 | R2 | Δ basis |
|---|---:|---:|---:|---|
| FUNCTIONALITY | 20 | 14* | 18 | Full E2E suite executed for the first time: **124 passed / 2 skipped** across Chromium/Android/iOS projects; fake-camera pipeline test passes; zero console errors on live site. |
| PERFORMANCE | 20 | 10* | 15 | 10 Hz page-tree renders isolated to Sign Coach subtree; adaptive vision tier implemented + measured (16.9 ms median inference w/ GPU → base tier held; software-GL worst case correctly downgrades). Remaining −5: no physical low-end device numbers. |
| MOBILE UX | 15 | 6* | 12 | Android+iOS Playwright projects now actually executed and passing (portrait geometry, touch, safe areas); camera-denied/hand-check flows validated end-to-end in a real browser. −3: physical-device sweep still outstanding. |
| GAMEPLAY / RECOGNITION | 15 | 8* | 13 | Recognition semantics untouched by perf work (time-windowed verifier; same thresholds); veto-gate shadow-mode measurement continues; confusor regression suites green (743 unit tests). |
| PRODUCT / CONVERSION | 10 | 8* | 9 | Copy-drift concern verified as non-issue against current code (guest path truly signup-free; replay opt-in); funnel already short. |
| ACCESSIBILITY | 5 | 4* | 4.5 | axe sweeps executed and passing on all three engine projects (the one timeout was CPU contention, passed in isolation at 22 s). aria-live contract preserved through the render-isolation refactor. |
| SECURITY / PRIVACY | 5 | 4* | 4.5 | Privacy claim mechanically re-verified this round: no frame/image transmission paths exist in src; analytics payloads carry booleans/reasons only. |
| RELIABILITY | 5 | 4* | 4.5 | Latest-frame vision gating (no backlog possible), fail-open classifier unchanged, pacer is one-way/stable. |
| TESTING | 5 | 4* | 5 | The "E2E never run" gap from Round 1 is closed: canonical suite + ad-hoc fake-camera suite both executed and green; 743 unit tests incl. 8 new VisionPacer tests. |

*R1 scores were mapped onto the new category weights; the underlying evidence is in the Round 1 table below.

### Why not higher
- **Physical low-end device validation remains outstanding** (biggest single gap, −~5 pts across Performance/Mobile).
- Sustained-session (30+ min) thermal/memory soak untested.
- oxlint carries 30 pre-existing exhaustive-deps warnings worth triaging.

---

## ROUND 1 SCORE (2026-08-22, pre-Round-2) — preserved

# Overall: 78 / 100

| Category | Weight | Score | Weighted | Basis |
|---|---:|---:|---:|---|
| Core functionality | 15 | 14/15 | 14.0 | Recognition+gating works; 735 tests green; live flows error-free. −1: engine duplicated Py↔TS (drift risk, documented). |
| Gameplay reliability | 10 | 8/10 | 8.0 | Debounce/hold logic sound, skip/complete honest; race guards present. −2: e2e specs not executed this session; no automated game-flow regression in CI evidence. |
| Camera/CV performance | 15 | 10/15 | 10.0 | Pipeline already well-throttled (28 fps vision/10 Hz UI); per-frame canvas realloc bug found & fixed. −5: no adaptive tiering; no real-device measurements yet. |
| Mobile performance | 10 | 6/10 | 6.0 | PWA, portrait-safe mirror, iOS background/mute recovery all handled. −4: low-end validation outstanding; heavy chunks (tfjs 272 kB gzip) mitigated by code-split but real on 3G. |
| UX | 10 | 8/10 | 8.0 | Short onboarding, actionable camera errors, per-parameter coaching is genuinely differentiating. −2: minor copy drift ("Free, no signup" vs auth modal), warm-up state on slow networks. |
| UI / visual polish | 10 | 8/10 | 8.0 | Coherent z-* token system, dark/light themes, documented contrast fixes. −2: loading states on social lists; hit-area consistency. |
| Accessibility | 5 | 4/5 | 4.0 | aria-live phase announcer, sr-only text, axe-core wired in e2e deps, contrast fixes documented in code. −1: full axe run not executed this session. |
| Marketing / conversion | 10 | 8/10 | 8.0 | Strong honest landing (on-device claim is TRUE and verifiable), OG/Twitter cards, sitemap, alphabet page, real feedback form. −2: funnel copy drift; social-proof absent (correctly — none exists yet). |
| Security | 5 | 4/5 | 4.0 | No secrets in client bundle (VITE_ anon key is public-by-design), RLS + private channels documented, prior admin hardening in worklog. −1: independent re-verification of live RLS policies not performed this session. |
| Testing / reliability | 5 | 4/5 | 4.0 | 56 files / 735 tests incl. confusor regressions + avatar tests. −1: e2e not run routinely; no CI badge evidence checked. |
| Deployment / production | 5 | 4/5 | 4.0 | Vercel auto-deploy on main, PWA precache, prod e2e config exists, kill switches for camera/classifier. −1: main auto-deploys = risky without branch protection evidence. |
| **Total** | **100** | | **78.0** | |

Score philosophy: no inflation. The 78 reflects a genuinely well-engineered app whose gaps
are **validation gaps** (devices, e2e execution) plus **adaptive performance**, not
broken fundamentals. Nothing discovered blocks shipping to real users today.

---

## A–U SECTION SUMMARIES (detail in ASL_GAME_AUDIT.md)

- **A. Architecture** — client-side recognition (rule engine + veto-only TF.js), Supabase for
  identity/progress only. Assumed FastAPI/WS/LSTM backend does not exist. Python core = rule
  source of truth; TS engine is a port. Duplication is the top structural risk.
- **B. Frontend** — React 19 + Vite 8, Zustand persist, code-split pages + vendor chunks.
  Hot-path render rates deliberately throttled; memoization partial.
- **C. Backend** — none for recognition. Supabase (Postgres + Auth + Realtime) with RLS and
  documented migrations under `supabase/`.
- **D. ML/CV** — MediaPipe Tasks 0.10.35 (hand+pose, GPU→CPU fallback, version-pinned WASM);
  Bi-GRU classifier as veto-only gate with fail-open semantics and known-signs exclusion set.
- **E. Camera pipeline** — 640×480 ideal, stall/mute/visibility recovery, kill switch.
  Fixed: per-frame canvas realloc + unthrottled preview draws (b053c1e).
- **F. Gameplay** — lessons/practice/story/speed/duel/room; static-hold vs movement debounce;
  honest completion states; skip acknowledged with coach line.
- **G. Performance** — see audit §B; biggest remaining lever = adaptive vision tiers.
- **H. Mobile** — viewport-fit cover, portrait aspect tracking, iOS PWA meta, in-app-browser
  detection banner, touch cards generously sized.
- **I. Low-end devices** — throttled pipeline helps all devices; explicit tiering not yet
  implemented; **no physical low-end validation performed** (honest gap).
- **J. UX** — onboarding 3 taps to value; camera-denied path actionable; recognition feedback
  via ParameterChecklist is the product's signature.
- **K. UI** — tokenized, themed, documented contrast decisions; polish items only.
- **L. Accessibility** — live regions, sr-only, axe-core in toolchain; run axe e2e routinely.
- **M. Marketing** — landing.html is honest, specific, and matches implementation; CTA chain
  verified live.
- **N. SEO** — title/desc/canonical/OG/Twitter/JSON-LD (Organization + SoftwareApplication),
  robots.txt + sitemap.xml present.
- **O. Security** — anon-key public-by-design; RLS documented; no secrets found in client;
  camera data never leaves device (privacy claim = true).
- **P. Reliability** — fail-open classifier, retryable capture init, sync error surfacing,
  camera stall detection, kill switches.
- **Q. Testing** — 735 unit green (pre & post fix); Playwright suites present (not run here).
- **R. Deployment** — Vercel + PWA; main auto-deploy noted as risk without protection.
- **S. Analytics** — PostHog with consent gate, 42-event taxonomy, kill-switch flags.
- **T. Code quality** — exceptional inline WHY-comments; 30 lint warnings (deps arrays),
  0 errors; god-store/page size documented in ARCHITECTURE.md with a refactoring plan.
- **U. Product readiness** — shippable today for beta audiences; the P1 list below is the
  gap to a confident public push.

## SHIPPING GATES

**P0 (blockers):** none found. No crashes, dead ends, broken auth, or data-loss paths were
observed in code or live walkthrough.

**P1 (before public push):**
1. Real-device (or rigorously throttled) camera/perf validation incl. the b053c1e fix —
   until measured, no "runs great on low-end phones" claims.
2. Adaptive vision tiering (measured, config-gated).
3. React.memo on hot subtrees consuming 10 Hz `result`.
4. Execute Playwright e2e (incl. fake-camera) and axe run; fix whatever falls out.
5. Funnel copy drift cleanup.

**P2 (polish):** LessonPage dep-array effect clarity; lint warning triage; social-list
skeletons; rVFC preview draws; hit-area sweep.

**P3 (future):** per-user calibration; NMM/blendshape signs; shared JSON sign source
(REFACTORING_PLAN.md); worker-based inference only if long-task profiling demands it.

## SHIP DECISION

**Round 1 (78): SHIP WITH KNOWN LIMITATIONS** — beta/soft launch.
**Round 2 (86): SHIP WITH MINOR FOLLOW-UPS** — the product is now validated end-to-end by an
executed E2E suite (incl. a real camera pipeline test), carries measured adaptive performance,
and has no known P0/P1 defects. What separates 86 from 90+ is exclusively **hardware-truth**:
physical low-end Android/iPhone measurement of the full loop, and a long-session soak. Those
are validation activities, not code changes — they cannot be honestly scored without the devices.

---
