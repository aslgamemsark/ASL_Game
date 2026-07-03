# Product

## Register

product

## Users

ASL learners of **all ages** — beginners first. They arrive curious, often with zero sign
vocabulary, and practice in short sessions (a few minutes at a time) in front of their webcam at
home. Their job-to-be-done: *learn real, correctly-formed ASL signs and know WHY an attempt was
wrong* — the per-parameter Sign Coach (handshape / location / movement / orientation feedback) is
the product's genuine differentiator over flashcard-style apps. A secondary audience is the
learner's household: the app should feel friendly enough for a kid to use and respectable enough
for an adult to keep using.

## Product Purpose

A gamified ASL learning game ("SignUp", mascot: Zippy 🤟) where the player performs signs to their
webcam and rule-based geometry (plus an ML veto layer) verifies each of the five ASL parameters
independently. Scenario worlds (Coffee Shop → Hospital → Classroom) give vocabulary real
conversational context via NPC role-play stories. Success = a learner who can actually produce
correct signs, not just recognize them — retention mechanics (streaks, XP, quests, badges) serve
that goal, never replace it.

## Brand Personality

**Encouraging, playful, credible.** Warm coach energy — celebrates real effort, never mocks a
failed attempt (the coach TELLS you which parameter missed and how to fix it). Playful without
being childish: the mascot and emoji carry personality, but typography and layout stay clean and
grown-up. Confident about the tech (recognition runs on-device, privately) without being clinical.

## Anti-references

- **Generic AI-generated SaaS look**: wall-to-wall purple/cyan gradients, gradient text on every
  heading, glassmorphism cards. The purple/teal Zippy palette is the committed identity — keep it,
  but carried by solid confident color and hierarchy, not by stacking gradients on everything.
- **Kiddie edutainment**: rainbow-everything, bouncing letters, condescending copy.
- **Flashcard-app sterility**: endless identical card grids with no narrative or personality.
- **Dark-mode-with-neon-glow "gamer" aesthetic**: glows and pulses reserved for genuine moments
  (streak fire, success flash), never ambient decoration.

## Design Principles

1. **Coach, don't judge.** Failure states name the fixable parameter and show how — red is
   information, never punishment.
2. **The camera is the hero.** During recognition, the learner's own hands are the interface;
   chrome recedes, feedback overlays stay glanceable at arm's length from a webcam.
3. **Celebrate deliberately.** Big animation/sound/confetti moments are earned (sign passed,
   story complete, badge unlocked) — the rest of the UI stays calm so those moments land.
4. **Playful surface, rigorous core.** Emoji and Zippy carry warmth; numbers, progress, and
   feedback are always precise and honest (real percentages, real parameter scores).
5. **One identity, committed.** Purple is the brand (with teal/orange as functional accents for
   XP/streaks) — used with confidence as solid color, not diluted into gradient wallpaper.

## Accessibility & Inclusion

WCAG AA is the floor: body text ≥4.5:1 contrast (two violations were found and fixed 2026-07-03 —
scrims over gradient cards; don't reintroduce the pattern). This audience overlaps with the Deaf
and hard-of-hearing community: **never gate anything on audio** — every sound cue is decorative
and the app must be 100% usable muted (a mute toggle exists in the profile tab). Touch targets
≥44px. Framer-motion animations should respect `prefers-reduced-motion` (currently not
implemented — known gap, tracked in docs/vault/Decisions-Log.md's ideas list). Camera-based
recognition must keep working for different skin tones and lighting — threshold tuning uses
shoulder-width ratios, never absolute pixels, partly for this reason.
