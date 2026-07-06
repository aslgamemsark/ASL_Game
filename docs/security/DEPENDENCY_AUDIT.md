# Dependency Audit — ASL Game

_Date: 2026-07-06. Scope: `web/` npm dependencies. Python (`ml/`, `tools/`) runs locally only
(dev laptop), never in the user-facing attack surface, so it is lower priority — but listed._

## npm — automated scan

```
$ npm audit            → found 0 vulnerabilities
$ npm audit --omit=dev → found 0 vulnerabilities
```

No known CVEs in the dependency tree at audit time. This is a real strength — but `npm audit` only
catches *published advisories*; it does not prove the absence of supply-chain risk, so the
manual notes below still matter.

## Notable production dependencies (attack-surface relevant)

| Package | Role | Security notes |
|---|---|---|
| `@supabase/supabase-js` | auth, DB, realtime | The entire backend client. Keep current — auth/JWT bugs here are high-impact. Pin and watch for advisories. |
| `@mediapipe/tasks-vision` | on-device hand/pose/face landmarking | Loads WASM + model assets at runtime. Large third-party binary surface, but runs client-side on the user's own webcam — no server trust. CSP must allow its WASM (`wasm-unsafe-eval`) and asset origins (see VULN-05). |
| `@tensorflow/tfjs` | runs the sign classifier | WASM/WebGL backend; lazy-imported (`engine/classifier.ts`). Same CSP consideration. Heavy dependency — a supply-chain compromise here executes in every user's browser. |
| `three` + GLTF/Orbit examples | avatar viewer (currently paused feature) | Large; only loaded on avatar routes. Consider code-splitting so it isn't in the main bundle if the avatar lab isn't user-facing yet. |
| `react` / `react-dom` | UI | Auto-escaping is our primary XSS defense — keep current. |
| `framer-motion`, `zustand`, `canvas-confetti`, `@tailwindcss/vite` | UI/state | Low risk. |

## Supply-chain hardening recommendations

1. **Pin exact versions** (commit `package-lock.json` — verify it's tracked) and enable
   Dependabot/Renovate for security-only updates.
2. **Add `npm audit` (and `npm ci`) to CI** so a newly-published advisory fails the build rather
   than silently shipping.
3. **Subresource/asset integrity for CDN-loaded model & WASM** — MediaPipe/TF.js often fetch WASM
   and model files from a CDN at runtime. Confirm where those load from; if from a third-party
   CDN, pin versions and restrict `connect-src`/`script-src` in the CSP to those exact origins so a
   CDN compromise can't inject arbitrary code.
4. **Three.js**: if the avatar lab is not shipped to users, ensure it's route-split and not in the
   critical bundle — it's a large surface for a paused feature.

## Python tooling (`ml/`, `tools/`) — lower priority

Runs only on the developer laptop (training, dataset export). Not part of the user attack surface.
`tools/export_supabase_samples.py` uses the **service-role key from env** — the one place that key
is used. Keep that key out of any shared/committed `.env` and off any deployed host. No automated
Python dependency scan was run here; if these scripts ever move to a server or CI, run
`pip-audit` on `requirements`/the `.venv-ml` environment.

## Bottom line

Dependency hygiene is currently **good** (0 advisories). The main forward risks are supply-chain
(the two big WASM/ML packages execute in every user's browser) and the absence of CI-enforced
auditing — both cheap to address before real users arrive.
