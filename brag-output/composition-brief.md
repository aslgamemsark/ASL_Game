# Hyperframes Composition Brief: QuickSign

## Objective
Create a short launch-style brag video for QuickSign (a browser-based ASL learning app), for
posting to TikTok, YouTube (Shorts), and LinkedIn.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 20 seconds

## Source Material
- Project root: `E:\ASL_Game`
- Primary files read: `web/index.html`, `web/src/index.css`, `web/README.md`,
  `web/package.json`, `web/src/components/lesson/ParameterChecklist.tsx`,
  `web/public/zippy/*.webp`
- Product name: QuickSign
- Tagline / strongest claim: "Most apps ask you to recognize a sign. QuickSign watches you make
  it — and tells you exactly which part to fix."
- Key UI or visual moment to recreate: the live `ParameterChecklist` — 4 rows (Hand shape /
  Position / Movement / Palm direction), each a gray pending pill that flips to a green ✓ with a
  filling progress bar as the user signs correctly, next to Zippy (the mascot) reacting with
  different expression art per moment.
- Copy that must appear verbatim:
  - "Most ASL apps just show you a video."
  - "This one watches you sign it back."
  - "Learn ASL. Actually sign it."
  - "Free · runs in your browser · camera never leaves your device."

## Creative Direction
- Tone preset: `default`
- Creative direction: playful-but-credible product demo — confident claim, warm mascot payoff,
  clean enough to double as a LinkedIn post without a re-edit.
- Interpretation: comfortable pacing, crossfades/clean wipes between scenes, one clear
  claim/moment per scene, enough hold time for the checklist rows to actually be read.
- Angle: every competing ASL app is a quiz — QuickSign is the only one that watches the user
  actually sign back and grades it live, parameter by parameter. The video's whole job is landing
  that one fact.
- Hook: "Most ASL apps just show you a video." → hard-cut to "This one watches you sign it back."
- Outro / punchline: "Learn ASL. Actually sign it." + trust line under the wordmark.
- Avoid:
  - Generic SaaS language ("streamline", "workflow", etc.)
  - Abstract filler visuals / stock motion graphics
  - Unrelated visual redesign — use the app's actual dark-purple theme and Quicksand type, not a
    new palette

## Visual Identity
- Background: `#0D0A1E`
- Card surface: `#18103A` / `#221548`
- Accent (primary brand gradient): `#7C3AED` → `#A78BFA`
- Success green: `#34D399` · Error/miss red: `#EF4444` · Teal/yellow highlight: `#5EEAD4`
- Text: `#F5F3FF` primary, `#9C90B0` muted
- Display font: Quicksand (variable 300–700) — same face used everywhere in-app, no separate
  display face
- Body font: Quicksand
- Visual references from the project: the `ParameterChecklist` row treatment (rounded pill +
  progress bar + ✓/…/✗ state), the app's rounded-card dark shell, Zippy mascot expression art
  (`thinking`, `thumbsup`, `celebrating`, `welcome` from `web/public/zippy/`)

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 2.5s — "Most ASL apps just show you a video." (bold centered text, near-silent)
2. Reveal — 3s — "This one watches you sign it back." + app card frame sliding into view
3. The product, live — 9s — ParameterChecklist clearing 4 rows one by one in sync with Zippy
   (thinking → thumbsup → celebrating) + confetti payoff on the last clear
4. Outro / punchline — 5.5s — "Learn ASL. Actually sign it." + wordmark + trust line, music fades

## Audio
- Audio role: warm upbeat bed, sparse motion-matched SFX on checklist clears
- Audio arc: fades in low under the hook, comes up full on the reveal cut, rides the beat grid
  through the 4 checklist clears with a swell into the confetti payoff, fades out under the outro
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120.19 BPM)
- Music treatment: low fade-in under Scene 1, full bed from Scene 2, beat-riding through Scene 3,
  fade-out starting mid Scene 4
- Music cue guidance: bundled preset at
  `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json` (also
  copied alongside the track). Strong cues near 16.02s/17.02s/18.02s/20.02s in the source track's
  own timeline — re-anchor proportionally to this composition's Scene 3 window (its 4 checklist
  clears) rather than using those raw timestamps verbatim, since Scene 3 starts at ~5.5s into this
  20s edit, not at 16s. Use the nearest strong/high-strength beats within Scene 3's span for the
  4 clears.
- Audio-reactive treatment: subtle — confetti burst and Zippy's "celebrating" pose may gain a
  touch of scale/glow keyed to music energy on the beat it lands on. No waveform bars, no
  bass-pumping UI chrome.
- Audio-coupled moments:
  - Scene 3, each of the 4 checklist rows clearing — soft tick SFX, beat-grid snapped
  - Scene 3, confetti burst on the 4th clear — warmer success chime, strong-cue locked
  - Scene 4, outro line typing in — subtle key ticks (restrained)
- SFX selection guidance: card/tick sounds for the checklist rows (they're small sequential UI
  state changes, not full card reveals), one clear "success" chime for the confetti moment. Keep
  it sparse — this is a product demo, not a chaotic edit.
- SFX analysis guidance: use `skills/brag/assets/sfx/sfx-analysis.md` if present; prefer
  lower high-frequency-risk sounds since the checklist ticks repeat 4 times in 9 seconds.
- Exact SFX choice: Hyperframes chooses exact filenames/timestamps/density/volume once the
  animation is built.
- Audio files: copy the chosen music (and its cue JSON) into `brag-output/composition/assets/music/`
  before composing.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition
contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design
spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli`
(lint/check/render). `/brag` is its own workflow: do not enter the `hyperframes` entry-point
intent interview and do not route into its generic promo / launch-video workflow. Prefer native
Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (the
  ParameterChecklist rows + Zippy expression art).
- Keep all text readable in the final render — respect the reading-time floor from
  `brag-plan.md` (short label ~0.8s settled, sentence ~0.3s/word).
- Keep the video within 15-25 seconds (target 20s).
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet; choose exact SFX after the visual
  animation exists.
- Treat music cue metadata as optional timing hints — ignore cues that hurt readability, scene
  pacing, or the product story.
- Use only 1-3 strong cue locks in this 20s video (the reveal cut and/or the confetti payoff are
  the best candidates).
- Honor the planned fade-in/fade-out and beat-riding treatment described above.
- Consider the audio-reactive workflow for the confetti/Zippy moment (subtle, restrained — no
  waveform/equalizer visuals, no musical-note graphics, no strobing).
- Use local assets (the copied music file, the project's Zippy WebP art, the app's real color
  tokens/font) — do not invent a new visual identity.
- Run `hyperframes check` before render — it is brag's single gate.
