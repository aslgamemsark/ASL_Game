# OX_ALPHA_E4_AUDIO_INDEPENDENCE.md

**Task:** ASL-E4 · `[REPORT]` Audio-independence — verify the app remains fully usable with audio
unavailable (muted user, missing output device, locked-down kiosk). For this audience (ASL learners,
many Deaf/HoH) audio-only feedback is a product-critical defect class per the master mission.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `a5a96ac`) ·
**Method:** static inventory of every audio path + an EXECUTED probe (`web/e2e-adhoc/probe-audio-independent.mjs`)
that hard-blocks `AudioContext` (constructor throws, modeling "no working audio") and drives the real flows.
No code changed.

---

## 1. Static inventory — where audio exists

All game SFX are synthesized Web Audio (`src/lib/soundEffects.ts`, no asset files): `correct` / `wrong`
/ `levelUp` / `tap` / `streak` / `purchase` / `badgeUnlock`. They are gated by the Settings toggle
"Sound Effects" (`soundEnabled`, useSettingsStore.ts:21) through `useSounds()` (useSounds.ts:20-23),
which also fires independent vibration. Speech ("hear the sign name on success", `speakSign`,
speak.ts:9-14) is separately toggled and no-ops safely when unavailable. 28 call sites total:
9× correct, 7× levelUp, 5× tap, 3× wrong (+ streak/purchase/badgeUnlock paths).

## 2. The defect found: an audio failure breaks flows outright

**Finding E4-a (High for this audience): a throwing `AudioContext` aborts the action that triggered it.**

- Mechanism: `soundEffects.playNotes → getCtx()` (soundEffects.ts:6-15) lets the constructor's
  exception propagate; `useSounds` wrappers call the effects unguarded (no try/catch in
  useSounds.ts); callers invoke `sounds.tap()` **before** their navigation/state transition, inside
  the same onClick.
- Executed proof: with `AudioContext` constructor throwing, clicking **Practice Letters**
  (AlphabetTab.tsx:50 — `onClick={() => { sounds.tap(); onStartLettersPractice(firstLetters); }}`)
  throws before `onStartLettersPractice` runs. The screen does not change; the lesson never starts.
  Reproduced from BOTH entry cards (Alphabets tab card and Journey-tab card), throw count = 1 each.
- Blast radius if unfixed: every `sounds.X(); doThing();` pair shares the pattern (AlphabetTab ×3,
  BasicSignsTab ×2). Result-path calls that run BEFORE state updates — e.g. PracticePage.tsx:316
  `if (correct) { sounds.correct(); burst(); } else { sounds.wrong(); }` executes before
  `recordSign`/`addXp` at :317-325 — would skip scoring/progress entirely for a muted user once they
  reach a result (the probe could not reach that state because lesson start is already broken).
- Why it matters here specifically: Deaf/HoH users and locked-down school/kiosk devices are exactly
  the environments where audio output may be absent. A hearing user never notices; this population
  cannot start a lesson at all.

## 3. What is already right (verified live)

- Onboarding itself survives blocked audio end-to-end (Get started / Continue as guest / skill pick
  all worked in the probe — those buttons don't emit sound before acting, or their handlers act first).
- Sound is OFF-by-default-able via Settings, vibration is an independent channel, and speech has its
  own toggle plus safe no-op guards (speak.ts:10-11). The design intent — "sound is garnish" — is
  present everywhere EXCEPT the unguarded throw path above.

## 4. Recommended fix shape (owner decision — `[REPORT]` scope)

One-line-class fix, two candidate layers:
1. **Best:** swallow at the source — wrap `getCtx()`/`playNotes` bodies in try/catch (sound failure
   can then never break any caller), or
2. Belt-and-braces: make `useSounds.correct/wrong/...` wrap their `soundEffects.*` calls in try/catch.
Either restores full flow operability for muted users; layer 1 covers any future direct
`soundEffects.*` caller too.

## 5. Probe results summary (executed)

| Check | Result |
|---|---|
| Onboarding completes with AudioContext hard-blocked | PASS |
| Practice Letters starts lesson with audio blocked (Alphabets card) | FAIL — throws, no navigation |
| Practice Letters starts lesson (Journey-tab card) | FAIL — same |
| Unhandled-throw telemetry captured | 1 per attempt, `AudioContext blocked for E4 probe` |

Probe committed: `web/e2e-adhoc/probe-audio-independent.mjs` (re-run against any :4173 server of `dist/`;
exit 0 iff all checks pass — currently exits 1 BY DESIGN while finding E4-a exists).
