# OX_ALPHA_J2_PRIVACY_ON_BUILT_BUNDLE.md

**Task:** ASL-J2 · `[REPORT]` Re-verify the privacy claim on the **built bundle** — confirm "camera
never leaves your device" holds in `dist/` and at runtime: no upload endpoints, no frame/blob
transmission, MediaPipe local.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `23cf715`) ·
**Method:** executed two-part probe (`web/e2e-adhoc/probe-privacy-bundle.mjs`):
Part A = static scan of all 124 dist files for upload-capable patterns; Part B = live Playwright
session with the camera running, recording every external request for 15 s of active recognition.
No code changed.

---

## 1. Part A — static sweep of the built bundle (124 files)

| Pattern | Result |
|---|---|
| XHR `.open(POST/PUT)` upload calls | ✅ none |
| `FormData.append` with blob/file (multipart upload) | ✅ none |
| `canvas.toBlob(` / `toDataURL(` frame capture | ✅ none |
| `new MediaRecorder` | 1 hit — context-checked: **local replay feature only**, never sent |
| WebSocket media send | ✅ none |
| base64 video payload markers (`data:video/…;base64`) | ✅ none |

## 2. Part B — live observation during real camera use

Ran an actual Practice Letters session with the fake camera streaming and the recognizer live, then
classified all 11 external requests observed over 15 s:

| Host | Direction | Purpose |
|---|---|---|
| `us.i.posthog.com`, `us-assets.i.posthog.com` | small POSTs | anonymous usage analytics (Settings-toggleable, documented) |
| `cdn.jsdelivr.net` | GET | library CDN |
| `storage.googleapis.com` | **GET ×2, zero uploads** | MediaPipe Tasks' official model/wasm CDN — downloading the hand-landmark model |

- **Zero requests to any non-allowed host.**
- **Zero large POST payloads (>50 KB)** — frame-upload scale traffic simply does not occur.
- Camera pipeline confirmed genuinely active during observation (`<video>` element with live stream).

## 3. Verdict

The privacy claim survives both static and dynamic verification on the built artifact:
frames are processed in-browser by locally-loaded MediaPipe wasm/models; the only outbound traffic is
analytics beacons, CDN downloads, and Supabase data calls — never video, never frames, never landmarks
without the separately-gated training opt-in (which posts numeric coordinates, not imagery).

One documentation improvement noted (not required): the MediaPipe model CDN
(`storage.googleapis.com`) is an inbound-only dependency worth listing alongside the privacy copy's
existing disclosures.

## 4. Re-run

Requires a local preview server on :4173 serving `dist/`.
`node web/e2e-adhoc/probe-privacy-bundle.mjs` (exit 0 iff all checks pass).
