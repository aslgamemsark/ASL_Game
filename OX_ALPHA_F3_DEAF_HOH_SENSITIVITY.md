# OX_ALPHA_F3_DEAF_HOH_SENSITIVITY.md

**Task:** ASL-F3 · `[REPORT]` Deaf/HoH sensitivity review — audit copy, imagery, and interaction
patterns for hearing-norm assumptions and Deaf-culture sensitivity. **REPORT ONLY per the master
mission: everything here is the owner's call.**
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `73c96a9`) ·
**Method:** full-copy sweep of user-facing strings (onboarding, settings, lessons/stories/quests/
badges/shop data, Zippy line banks), cross-checked against this session's executed audits (E2
keyboard, E4 audio-independence, D-series UX/error states). No code changed.

---

## 1. What the app already does right (verified, not assumed)

1. **PRODUCT.md states the contract explicitly** (lines 56–65): "never gate anything on audio",
   100%-usable-muted requirement, AA contrast floor, skin-tone/lighting-aware recognition thresholds.
   This session's audits measured against that contract: E4 found the one violation (audio-throw
   breaks lesson entry — owner decision pending); D5 verified reduced-motion; D1 verified layout.
2. **Sound is decorative and off-switchable**: "Sound Effects" toggle (SettingsPage.tsx:94),
   independent vibration channel, and speech ("Speak sign names") is its own opt-out-able setting
   with a safe no-op when unavailable (speak.ts:10–11).
3. **No hearing-norm shaming copy anywhere in the sweep.** No "listen carefully", no voice-required
   flows, no "if you can hear this" patterns. The word "hear" appears in user-facing copy exactly
   zero times (only in code comments).
4. **Visual-first instruction**: every sign carries a text description of the handshape/motion
   (signs.ts descriptions like "Flat hand from chin, move outward/down"), reference clips are
   visual video, and success/completion feedback is visual + haptic + optional speech.
5. **ASL is treated as the primary language**, not a translation layer: onboarding asks "How much
   ASL do you know?" directly; the product name and framing center signing.

## 2. Findings for the owner's judgment (all minor; none block shipping)

**F3-a — "Say Hello" naming uses spoken-language framing for a sign.** The first lesson/story/badge
is titled "Say Hello" and NPC dialogue uses "can you *say* hello back?" / "*say* hello?" (stories.ts
×4, lessons.ts ×2+). In Deaf-culture terms the action being taught is **signing** hello, not saying
it — many Deaf users read "say" as voice-channel language. Suggested alternatives if the owner wants
tighter alignment: "Sign Hello", "can you sign hello back?". Note: "say hello" also reads naturally
as the English idiom for greeting (hearing users won't blink), so this is polish, not harm. Count:
~11 occurrences across lesson titles/descriptions + 4 story lines.

**F3-b — speech default is ON (`speechEnabled: true`, useSettingsStore.ts:23).** For an app whose
core audience includes Deaf/HoH learners, defaulting text-to-speech ON assumes a hearing user.
It's one toggle away and harmless when off, but the sensitivity-optimal default is OFF (or asked
during onboarding). Owner's call — flipping the default changes behavior for existing installs.

**F3-c — no Deaf/HoH self-ID or community representation in onboarding.** Skill levels are framed
purely by experience ("Just Starting" → "Advanced"); there's no "I'm a Deaf signer", CODA, or
"learning to communicate with a Deaf family member" option, and marketing/landing surfaces (out of
web/ scope) weren't audited here. This is representation, not functionality — flagging because the
mission calls it out as a sensitivity dimension, not because anything is wrong.

## 3. Cross-references to already-documented findings

- **E4-a** (audio throw breaks Practice Letters entry) remains THE sensitivity-relevant defect —
  it hits precisely the no-audio users this review centers. Fix shape documented there.
- **F2-b** (quiz misses are color-only) interacts: color-only feedback under-serves low-vision
  learners in the same inclusive-design family.
- **D2/D3** verified empty/error states avoid idioms that assume hearing.

## 4. Verdict

The app's foundations respect the stated inclusion contract; nothing in the sweep is disrespectful
or exclusionary in copy or imagery. Three polish-level items (F3-a "say" phrasing, F3-b speech
default, F3-c representation options) are documented for the owner — all are judgment calls about
audience and identity, which is exactly why this task is report-only.
