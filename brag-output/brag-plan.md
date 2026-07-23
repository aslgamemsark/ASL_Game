# Brag Plan: QuickSign

## What is this app?
QuickSign is a browser-based ASL learning app that uses your webcam to watch you actually *perform*
each sign — not just pick a multiple-choice answer — and tells you the exact hand/position/movement
detail to fix, coached by a mascot named Zippy.

## The angle
Every other "learn ASL" app is a quiz: watch a video, click the matching answer. QuickSign is the
only one that watches YOU sign back and grades it live, parameter by parameter. The video's whole
job is to make that one fact land: your camera becomes the teacher, not a video player.

## Hook (first 2-3 seconds)
Bold on-screen line, deadpan-confident: **"Most ASL apps just show you a video."** — held just long
enough to read, then hard-cut/wipe to **"This one watches you sign it back."** as a live webcam
frame with the ParameterChecklist snaps into view. The claim IS the hook — pulled straight from the
site's own tagline, not invented.

## Key moments (the middle)
- The **ParameterChecklist** live in action: 4 rows (Hand shape / Position / Movement / Palm
  direction) each holding a gray "…" pill, one at a time flipping to a green ✓ with its progress
  bar filling to 100% — this is the single most product-specific visual QuickSign has.
  Continue to the next chat turn to render the full checklist and the rest of the storyboard.
- Zippy reacting: "thinking" while the user signs → "thumbsup" the instant a param clears →
  "celebrating" with confetti when the whole checklist goes green. Zippy is the emotional beat,
  the checklist is the proof.
- A quick glimpse of the app shell around it (dark purple theme, Quicksand rounded type, the
  webcam mirror in a rounded card) so it reads as a real product, not a mockup.

## Outro / punchline
Checklist fully green, confetti settles, Zippy giving a thumbs-up. Final line types in:
**"Learn ASL. Actually sign it."** — then the wordmark + "Free · runs in your browser · camera
never leaves your device" as a small trust line underneath.

## User flow worth showing
Entry → key action → result, pulled straight from the real Lesson flow:
1. **Entry:** camera comes on, Zippy ("thinking" pose) prompts the user to make a sign; the
   ParameterChecklist sits below the webcam mirror, all rows gray/pending.
2. **Key action:** as the (simulated) user signs, checklist rows flip gray→green one at a time
   with their progress bars filling — this IS the product working, not a description of it.
3. **Result:** last row clears, full-green checklist, confetti burst, Zippy "celebrating" +
   "+XP"/success flash consistent with the app's real success moment.

## Tone
- Preset: `default`
- Creative direction: playful-but-credible product demo — confident claim, warm mascot payoff,
  clean enough to also post on LinkedIn without re-editing.
- Interpretation: comfortable pacing (not rapid-fire chaotic cuts), crossfades/clean wipes between
  scenes, one clear joke/claim per scene, room for the checklist rows to actually be read.

## Format: vertical — 1080x1920
## Duration: 20 seconds

## Visual identity (from the project)
- Background: `#0D0A1E` (dark theme `--rt-z-bg`, near-black deep purple)
- Card surface: `#18103A` / `#221548`
- Accent (primary brand): `#7C3AED` → `#A78BFA` gradient (`bg-gradient-primary`, the app's
  single most-repeated CTA treatment)
- Success green: `#34D399` · Error/miss red: `#EF4444` · Teal/yellow highlight: `#5EEAD4`
- Text: `#F5F3FF` (primary), `#9C90B0` (muted)
- Display + body font: **Quicksand** (variable weight 300–700, rounded/friendly geometric sans —
  used for everything, no separate display face)
- Strongest visual element: the ParameterChecklist rows (gray pill → green ✓ + filling progress
  bar), paired with Zippy's expression art (`public/zippy/*.webp`: thinking, thumbsup,
  celebrating, welcome)

## Share copy (draft)
"Your webcam is now your ASL teacher 🤟 QuickSign watches you actually sign — and tells you
exactly what to fix. Free, runs in your browser, camera never leaves your device."

## Audio direction
- Role: warm upbeat bed, sparse motion-matched SFX on checklist clears
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120.19 BPM, bundled preset
  available) — friendly, energetic, not corporate-sterile
- Music treatment: fade in under the hook line, sit low through the claim reads, let the
  checklist-clearing sequence ride the beat grid, small swell into the confetti moment, fade out
  under the outro trust line
- Music cue guidance: preset read from `assets/music/cues/happy-beats-business-moves-vol-1-*.json`.
  Strong cues available at 16.02s, 17.02s, 18.02s, 20.02s (four evenly-spaced strong beats) — use
  these for the four checklist-row clears so each ✓ lands on a beat. Beat grid runs ~0.5s apart
  starting 3.02s — fine for accent ticks (progress-bar fill starts, small dings) but the row
  labels themselves get a full settle hold (see reading-time floor below), not beat-snapped text.
- Audio-reactive treatment: subtle — the confetti burst and Zippy's "celebrating" pose may gain a
  touch of scale/glow on the beat it lands on; no waveform bars, no bass-pumping UI.
- SFX posture: sparse, motion-matched — one soft "tick" per checklist row clearing, one warmer
  "success chime" on the full-green + confetti moment. No SFX under the two hook text cards.
- Audio-coupled moments: the 4 checklist rows clearing (each synced to a strong beat), the
  confetti burst (synced to the swell), the outro line typing in.
- Restraint rule: never let music or SFX drive a checklist row to flip green before it's readable
  — visual pacing (see reading-time floor) always wins over beat-snapping.

## Storyboard

### Scene 1 — Hook — 2.5s
Full-bleed dark background (`#0D0A1E`). Bold centered white/lavender text: **"Most ASL apps just
show you a video."** Text slams in fast, holds ~1.8s (sentence-length floor), then a quick
hard-fade begins the transition.
Sequential/interaction: none
Audio intent: music fades in low, no SFX yet — let the claim land in near-silence for contrast
Audio-coupled idea: none
Music: upbeat bed, very low volume, building
Transition mood: clean → Scene 2

### Scene 2 — Reveal — 3s
Hard-cut/wipe to the counter-claim, same type treatment but accent-colored: **"This one watches
you sign it back."** Behind/around the text, the app's dark purple card frame and a webcam-mirror
silhouette start sliding into view from the edges, teasing Scene 3.
Sequential/interaction: none
Audio intent: music comes up to normal bed volume on the cut — the "reveal" beat
Audio-coupled idea: text arrival synced to a beat-grid tick
Music: upbeat bed, full volume
Transition mood: clean wipe → Scene 3

### Scene 3 — The product, live — 9s
Centerpiece. Real app chrome: dark card, rounded webcam mirror (mirrored feed framing), Zippy
("thinking" pose) beside it with a short prompt bubble. Below the mirror, the ParameterChecklist:
4 rows — Hand shape / Position / Movement / Palm direction — start gray/pending ("…"). One by one,
each row flips to green with a ✓ and its progress bar fills to 100%, each clear landing on a strong
beat (16.02s / 17.02s / 18.02s / 20.02s from the track's cue grid, relative-timed within the scene).
On the last row clearing, Zippy swaps to "thumbsup" then "celebrating", and a confetti burst fires
(reusing the app's real success-moment style).
Sequential/interaction: yes — 4 checklist rows clear one at a time, each with its own progress-bar
fill and a soft tick SFX; Zippy's expression changes in step with the last clear.
Audio intent: rhythmic, satisfying, builds anticipation to the confetti payoff
Audio-coupled idea: 4 checklist clears synced to strong beats; confetti burst synced to a swell
Music: upbeat bed riding the beat grid
Transition mood: soft crossfade → Scene 4

### Scene 4 — Outro / punchline — 5.5s
Checklist settles full-green, confetti fading, Zippy holding "celebrating"/thumbsup. Outro line
types in: **"Learn ASL. Actually sign it."** Below it, the QuickSign wordmark + small trust line:
"Free · runs in your browser · camera never leaves your device." Gentle hold before fade to black.
Sequential/interaction: yes — outro line types character by character, then wordmark + trust line
fade in beneath it.
Audio intent: warm resolution, music begins its fade
Audio-coupled idea: typing ticks on the outro line (subtle, restrained)
Music: fading out under the final hold
Transition mood: soft fade → end

**Music mood for this video:** upbeat, friendly, confident — never corporate-sterile, never chaotic.
**Audio summary:** Low-key fade-in under the two-line claim, full bed on the reveal, riding a
120 BPM beat grid through the four checklist clears with a swell into the confetti payoff, then a
gentle fade under the typed outro line and trust copy.
