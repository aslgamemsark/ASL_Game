# Pre-commercial-release licensing checklist

Consolidates every licensing caveat already flagged piecemeal across `CLAUDE.md` and
`docs/VIDEO_RETARGET_HANDOFF.md`, plus a few asset sources that were never checked at all. Nothing
here blocks continued development — everything below is fine for research/personal/internal use.
This is a checklist to work through **before charging money or otherwise commercially releasing**
the app, not an active problem.

## Already flagged, tracked here for one place to check them off

- [ ] **WLASL** (`data/wlasl/`, used to train `model_v4`/`model_v5`/`model_v6`): non-commercial /
      research-oriented license, history of source-video takedowns. User-authorized for
      training/experiments (2026-06-30). **Verify WLASL's current license terms before shipping
      any model trained on it in a commercial release.**
- [ ] **ASL Citizen** (`data/asl_citizen/`, used to train `model_v4`/`model_v5`/`model_v6` and as
      the avatar retarget source): license permits research use. **Confirm its terms explicitly
      cover baked-animation derivatives and a trained classifier shipping inside a commercial
      product** — this was flagged to the user 2026-07-02 but never independently re-verified
      against the license text itself. Note (2026-07-03): the classroom signs
      (TEACHER/WRITE/READ/NAME/FRIEND, added in `model_v6`) could not even be checked against ASL
      Citizen this session — only the post-extraction subset manifest is kept locally, not the
      raw dataset's full gloss list — so they're WLASL-only for now.
- [x] **StudioGalt Sign-Language-Mocap-Archive** (`data/galt_archive/`): confirmed **CC0 public
      domain** — zero licensing risk, commercial use explicitly included. No action needed.

## Not previously flagged — found while compiling this checklist

- [ ] **`web/public/models/avatar/ybot.glb`** (and the duplicate `reference_clips/blender/` copy):
      the `mixamorig:` bone-name prefix throughout this codebase indicates this is Mixamo's stock
      "Y Bot" character. **No sourcing/license note exists anywhere in the repo for this file.**
      Adobe Mixamo assets are free to use but carry their own terms (restrictions on
      redistributing the raw model/rig as a standalone asset, distinct from using it inside a
      finished application). Locate the original Mixamo terms of use and confirm the avatar
      pipeline's use (rig + baked animations shipped inside the app) is compliant before release.
- [ ] **`web/public/clips/*.mp4`** (COFFEE.mp4, HELLO.mp4, LETTER_A.mp4, etc. — the reference
      videos shown in lessons): no sourcing documented. If these were recorded by the team,
      no issue — get that confirmed in writing/commit history. If any were sourced from ASL
      Citizen, WLASL, or a third party, they inherit that source's license and need the same
      re-check as the datasets above.
- [x] **MediaPipe model files** (`models/*.task`, `web/`'s CDN-loaded equivalents — hand, pose,
      and the new face landmarker): Google-published, Apache 2.0. Commercial use is fine;
      Google's standard attribution/trademark guidelines apply if the MediaPipe name/logo is used
      in marketing, but the models themselves carry no restriction on the app.
- [x] **npm dependencies** (`web/`): `npx license-checker --summary` shows MIT/Apache-2.0/ISC/
      BSD/MPL-2.0 only — no GPL/AGPL/other copyleft licenses that would obligate releasing this
      app's own source. The one `UNLICENSED` entry is `web`'s own unpublished `package.json`
      (no `license` field set), not a third-party package — cosmetic, add a `license` field
      before any public npm-facing release if desired, not a legal blocker.
- [ ] **Fonts** (Quicksand, loaded from Google Fonts): Google Fonts are SIL Open Font License —
      permits commercial use freely. No action needed beyond noting it here; not re-verified
      against the specific Quicksand license text.

## How to use this checklist

Before any commercial launch, go through every unchecked item above: read the actual license
text for that asset/dataset (not a summary), confirm the specific way this app uses it is
covered, and either get written confirmation or replace/re-source the asset if it isn't. The
checked items were verified as part of compiling this document (2026-07-03) — re-verify if
significant time has passed, since license terms and takedown histories (WLASL specifically) can
change.
