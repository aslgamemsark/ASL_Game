# Workstream B — Mobile: responsive + performance (no PWA/offline)

**Status: done.** Scope was explicitly limited to responsive/perf fixes — no `manifest.json`,
service worker, or offline model caching (user decision; the ~33MB CDN-loaded MediaPipe models are
re-downloaded every session, accepted for now).

## Changes
- `web/src/engine/capture.ts`: GPU→CPU delegate fallback (`withDelegateFallback`) wraps all three
  landmarker creations (Hand/Pose/Face) — devices without WebGL retry on CPU instead of failing
  the whole app.
- `web/src/hooks/useRecognition.ts`: capped the `requestAnimationFrame` loop to ~28fps
  (`MIN_FRAME_INTERVAL_MS`) — halves battery/thermal load on high-refresh mobile screens with zero
  effect on the rolling-window verifier (which windows by elapsed time, not frame count).
- `web/src/components/shared/CameraOnboarding.tsx`: removed the false "works offline once loaded"
  claim — the app has no offline caching by design (see above).

## Verified (via `preview_resize`, live DOM checks — not screenshots, which have been unreliable
this session for exact-layout claims)
No horizontal overflow at 375px (mobile), 768px (tablet), or 1280px (desktop) on the home page,
world-detail view, or the 26-letter ABCs grid. Bottom nav buttons are 59px tall — comfortably
above the 44px minimum touch target.
