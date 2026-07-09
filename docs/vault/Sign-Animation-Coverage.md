# Sign Animation Coverage Sheet (2026-07-09, updated)

Cross-referenced `web/src/data/signs.ts` (51 registered signs) against `web/public/clips/`
(StudioGalt-rendered + 3D-LEX-rendered), the downloaded 3D-LEX ASL animation export
(`data/3dlex/`, 938 words), and the free Fab "ASL Animation Pack" (47 animations, alphabet +
common words).

**3D-LEX pipeline note:** Blender's native FBX importer silently mishandles a nonstandard
transform-inheritance mode (`eInheritRrSs`) some of 3D-LEX's Unreal-exported rigs use, garbling
mesh deformation with no warning. Fix: convert FBX → GLB via the `fbx2gltf` tool first (not
Blender's own FBX import, not a direct glTF export), then import the GLB. See
`data/galt_archive/render_demo_clips.py` for the full pipeline (handles both FBX and GLB
sources, source-appropriate camera facing, stray-mesh exclusion, broken-texture fallback).

| Sign | Status | Source |
|---|---|---|
| BREATHE | ✅ Live | StudioGalt |
| COFFEE | ✅ Live | StudioGalt |
| DIZZY | ❌ No source yet | — |
| DOCTOR | ✅ Live | 3D-LEX (via fbx2gltf) |
| EMERGENCY | ❌ No source yet | — |
| FEVER | ❌ No source yet | — |
| FRIEND | ❌ No motion data in source | 3D-LEX (unusable — zero animation channels) |
| HELLO | ✅ Live | StudioGalt |
| HELP | ✅ Live | 3D-LEX (via fbx2gltf) |
| HOSPITAL | ✅ Live | 3D-LEX (via fbx2gltf) |
| LETTER_A | ✅ Live | StudioGalt |
| LETTER_B | ✅ Live | StudioGalt |
| LETTER_C | ✅ Live | StudioGalt |
| LETTER_D | ✅ Live | StudioGalt |
| LETTER_E | ✅ Live | StudioGalt |
| LETTER_F | ✅ Live | StudioGalt |
| LETTER_G | ✅ Live | StudioGalt |
| LETTER_H | ✅ Live | StudioGalt |
| LETTER_I | ✅ Live | StudioGalt |
| LETTER_J | ✅ Live | StudioGalt |
| LETTER_K | ✅ Live | StudioGalt |
| LETTER_L | ✅ Live | StudioGalt |
| LETTER_M | ✅ Live | StudioGalt |
| LETTER_N | ✅ Live | StudioGalt |
| LETTER_O | ✅ Live | StudioGalt |
| LETTER_P | ✅ Live | StudioGalt |
| LETTER_Q | ✅ Live | StudioGalt |
| LETTER_R | ✅ Live | StudioGalt |
| LETTER_S | ✅ Live | StudioGalt |
| LETTER_T | ✅ Live | StudioGalt |
| LETTER_U | ✅ Live | StudioGalt |
| LETTER_V | ✅ Live | StudioGalt |
| LETTER_W | ✅ Live | StudioGalt |
| LETTER_X | ✅ Live | StudioGalt |
| LETTER_Y | ✅ Live | StudioGalt |
| LETTER_Z | ✅ Live | StudioGalt |
| MEDICINE | ❌ No motion data in source | 3D-LEX (unusable — zero animation channels) |
| MORE | ❌ No source yet | — |
| NAME | ❌ No motion data in source | 3D-LEX (unusable — zero animation channels) |
| NURSE | ✅ Live | 3D-LEX (via fbx2gltf) |
| PAIN | ❌ No motion data in source | 3D-LEX (unusable — zero animation channels) |
| PLEASE | ✅ Live | StudioGalt |
| READ | ✅ Live | 3D-LEX (via fbx2gltf) |
| SICK | ❌ No source yet | — |
| TEACHER | ✅ Live | 3D-LEX (via fbx2gltf) |
| THANK_YOU | ⬜ Pending download/export | Fab pack |
| WANT | ✅ Live | 3D-LEX (via fbx2gltf) |
| WATER | ✅ Live | 3D-LEX (via fbx2gltf) |
| WRITE | ✅ Live | 3D-LEX (via fbx2gltf) |
| YES | ✅ Live | 3D-LEX (via fbx2gltf) |
| YOU | ✅ Live | StudioGalt |

## Summary

- **41 live** (26 StudioGalt + 10 newly-integrated 3D-LEX words + 5 previously-rendered letters
  now wired)
- **1 pending Fab pack** (THANK_YOU — not in 3D-LEX's export, is in Fab's free pack)
- **4 confirmed unusable from 3D-LEX** (FRIEND, MEDICINE, NAME, PAIN — the source FBX's own
  animation data has zero keyframe channels, confirmed both via Blender fcurve inspection and
  `fbx2gltf`'s own conversion log ("has zero channels. Skipping."); not fixable on our end)
- **5 genuinely uncovered anywhere** (DIZZY, EMERGENCY, FEVER, MORE, SICK) — notably 4 of these
  overlap with the same low-data hospital signs already flagged as ML-training gaps
  (`ml/runs/model_v4/class_report.json`), reinforcing that this is a real, recurring data gap
  worth targeting specifically (e.g. recording our own fixtures) rather than one more dataset
  search turning it up by luck.
