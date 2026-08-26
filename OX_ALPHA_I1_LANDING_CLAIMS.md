# OX_ALPHA_I1_LANDING_PAGE_CLAIMS.md

**Task:** ASL-I1 · `[REPORT]` Landing-page claims — audit public-facing copy (index.html meta/OG,
`landing.html`, PWA install prompt) for honesty against the delivered product.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `b5263d8`) ·
**Method:** full read of `web/index.html` (79 lines) and `web/public/landing.html` (1,359 lines),
cross-checking every public claim against this session's executed evidence. No code changed.

---

## 1. Claims inventory & verdicts

| Public claim | Where | Delivered reality | Verdict |
|---|---|---|---|
| "watches you make it — tells you exactly which part to fix" | index.html:14/26/34, landing lede | ParameterChecklist gives per-parameter feedback (handshape/orientation/location/movement) via `engine/verifier.ts` — rule-based, on-device | ✅ TRUE |
| "Free, in your browser" / "No signup required" | index.html:14; landing ×4 + FAQ schema | Guest path works end-to-end with zero account (G2/G4 executed); no paywall anywhere in the shop | ✅ TRUE |
| "camera never leaves your device" / "on-device AI" | index.html:14, landing lede | Recognition is fully client-side (MediaPipe in-browser); D3 confirms video never uploads | ✅ TRUE |
| "real-time feedback" | landing meta ×3 | Live loop runs at camera framerate with live checklist (E3 verified live regions announce it) | ✅ TRUE |
| "Learn through stories, multiplayer duels" | landing meta description | 5 stories exist (H6 inventory); Duel/Room/Friends shipped and tested (H5 surface count) | ✅ TRUE |
| "AI-powered Sign Coach" | landing meta description:8 | ⚠️ The coach is a **rule-based verifier** (`engine/verifier.ts`), not AI/ML inference of any kind | ❌ OVERSTATES |
| "Learn ASL" (title-level framing) | og:title "Learn to sign. Actually sign." | 51 signs ≈ beginner foothold, not fluency (H6). Marketing-normal hyperbole; H1 shows the journey honestly supports "learn your first signs" | ⚠️ Acceptable puffery |

## 2. Findings

**I1-a — "AI-powered Sign Coach" is the one false claim.** The only public copy that misdescribes the
product. Everything called a coach runs through a deterministic rule verifier (handshape gates,
location/movement checks) plus MediaPipe landmark detection — calling it "AI-powered" invites
disappointment and undermines trust for precisely the skeptical audience the privacy claims target.
Fix shape: change three words in `landing.html:8` ("an instant Sign Coach" / "a real-time Sign Coach").
The app itself never uses "AI-powered" anywhere in-product (grep across src: zero hits).

**I1-b — everything else survives scrutiny**, including the claims most likely to be challenged
(privacy/local-processing, free/no-signup, per-parameter feedback). Notably strong: the FAQ schema
("Is it free? Yes") matches reality exactly.

**I1-c — minor inconsistency between surfaces:** index.html's meta description omits "AI-powered"
while landing.html:8 keeps it — aligning them would resolve I1-a as a side effect.

## 3. Verdict

Public copy is overwhelmingly honest — one phrase to fix. No code changed; owner decides whether to
adopt the suggested rewording.
