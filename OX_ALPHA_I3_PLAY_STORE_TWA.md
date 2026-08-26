# OX_ALPHA_I3_PLAY_STORE_TWA_READINESS.md

**Task:** ASL-I3 · `[REPORT]` Play Store readiness of the TWA — audit the PWA/TWA prerequisites:
manifest fields, icons, start_url/scope, digital asset links, service-worker/offline behavior.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `189d5c7`) ·
**Method:** static audit of `vite.config.ts` manifest block + `public/` assets + index.html TWA
meta tags; production manifest re-verified live via `probe-seo.mjs` (I2's 12/12 run). No code changed.

---

## 1. Prerequisite checklist (Bubblewrap/PWABuilder requirements)

| Requirement | Status | Evidence |
|---|---|---|
| Manifest served over HTTPS | ✅ | I2 probe: parses on production, name/short_name set |
| `name` + `short_name` | ✅ | "QuickSign — Learn ASL with Zippy" / "QuickSign" (vite.config.ts:145-146) |
| `start_url` + `scope` | ✅ | `/` and `/` — app is single-origin, no scope leaks |
| `display: standalone` | ✅ | :151 |
| Icons: 192px + 512px PNG, maskable variant | ✅ | 192 any, 512 any, 512 maskable (:157-159); files exist in public/ |
| `theme_color` + `background_color` | ✅ | #120B1E / #0D0A1E (:149-150), consistent with index.html theme-color |
| `orientation`, `lang`, categories | ✅ | portrait / en / education+games |
| Service worker with offline fallback | ✅ | Workbox precache of app shell + navigateFallback=index.html; runtime caches for clips/models; autoUpdate registration (dev-verified per config comment) |
| Apple TWA meta (iOS fallback) | ✅ | apple-touch-icon, mobile-web-app-capable, status-bar style documented tradeoff |

## 2. Gaps between here and an actual Play Store listing

1. ~~**No Digital Asset Links**~~ — **CORRECTED during verification (2026-08-25): assetlinks.json
   EXISTS** at `web/public/.well-known/assetlinks.json`, deployed and serving 200 on production. It
   declares package `app.quicksign.twa` bound to a SHA-256 cert fingerprint, committed 2026-07-29
   ("Make the app work on phones"). The initial sweep missed it because `.well-known/` is a hidden
   directory that the file listing skipped. This means an Android TWA package was at least partially
   built at some point — whether a signed AAB still exists / matches this fingerprint is owner
   knowledge.
2. **No Bubblewrap project in the repo** (`twa-manifest.json` absent) — the Android-side build config
   lives outside the repo if it exists at all; regenerating the AAB requires the original signing key.
3. **Camera permission UX in a TWA** — WebRTC inside a Trusted Web Activity uses the same permission
   flow, but first-run camera denial inside a store-installed app has no Play-store-style rationale
   dialog. The app's honest denied-card (D3-verified) covers it adequately, but worth testing on a
   real device before submission.

## 3. Verdict

The web side is genuinely TWA-ready: every manifest/icon/SW prerequisite Bubblewrap checks passes
today, verified against production — and the site↔app trust link (assetlinks.json) is already live.
The remaining work is confirming/regenerating the Android package against that fingerprint, which is
owner-scope work requiring the signing key. No web-code changes warranted.
