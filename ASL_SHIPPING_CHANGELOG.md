# ASL_SHIPPING_CHANGELOG.md

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
