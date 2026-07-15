# Calibration log

Running record of real `/calibrate` findings and the fixes they led to. Raw CSVs (per-frame
scores + notes) are downloaded locally during a session and deleted once a finding here is either
fixed (commit referenced) or resolved as a non-issue — this file is the durable record, not the
CSVs themselves.

## 2026-07-14 — HELLO movement threshold too low

**Log**: `HELLO_2026-07-14T18-01-57...csv` + note "vibrate my hand a little, it passes, threshold
should be increased".

**Finding**: confusor (small hand vibration, no real repeated motion) sustained a 29-consecutive-
frame all-required-pass streak at `minConfidence: 0.25` — past the app's 6-frame accept debounce,
a genuine false accept.

**Fix**: raised `movement.minConfidence` 0.25 → 0.6 in `web/src/engine/signs/index.ts`. Confusor
streak drops to 0; real correct-performance streak stays 88 frames. Commit `899fefe`.

## 2026-07-14 — PLEASE movement threshold too low

**Log**: `PLEASE_2026-07-14T18-19-02...csv` + note "make sure at least one circular pass is
completed".

**Finding**: confusor (loose/partial circular motion) sustained a 13-consecutive-frame
all-required-pass streak at `minConfidence: 0.44`.

**Fix**: raised `movement.minConfidence` 0.44 → 0.7. Confusor streak drops to 0; real
correct-performance streak stays 130 frames. Commit `899fefe`.

## 2026-07-14 — THANK_YOU movement threshold too low

**First log**: `THANK_YOU_2026-07-14T18-22...csv` (x2, duplicate download of the same take) + note
"movement threshold too low, hand on chin instantly passes". Data contradicted the note at the
time — confusor phase never sustained a pass streak (0 frames) in that particular take.

**Follow-up log**: `THANK_YOU_2026-07-14T18-32...csv` + note "still same problem, movement goes to
0.5 and passes". This take reproduced it: confusor (chin touch/tap without a full downward push)
sustained a 36-consecutive-frame all-required-pass streak at `minConfidence: 0.25` (confusor
movement median 0.50) — well past the app's 6-frame accept debounce, a genuine false accept.

**Fix**: raised `movement.minConfidence` 0.25 → 0.85. Confusor streak drops to 0; real
correct-performance streak stays 14 frames. Commit `b474aa3`.

**Note**: RED and WANT share the same generic LINEAR-downward movement block (same thresholds,
copy-pasted) but are untested — flagged in a code comment, not fixed, since there's no log
evidence either way for them yet.

## 2026-07-14 — YES movement threshold too low

**Log**: `YES_2026-07-14T18-37...csv` + note "same with movement of YES, sometimes it passes
immediately when I put my hand on screen".

**Finding**: confusor (fist held still/on-screen, no real repeated bounce) sustained a
21-consecutive-frame all-required-pass streak at `minConfidence: 0.25`. This one was a knife-edge
cliff rather than a gradual slope — present at every threshold up to 0.25, gone entirely by 0.28.

**Fix**: raised `movement.minConfidence` 0.25 → 0.4 (real margin past the cliff, not sitting right
on the edge). Confusor streak drops to 0; correct-take streak stays 70 frames. Commit `1214b19`.

## Pattern noticed 2026-07-14 — `minConfidence: 0.25` looks like an uncalibrated shared default

Every sign fixed so far this session (HELLO, PLEASE\*, THANK_YOU, YES) started at either the exact
same `movement.minConfidence: 0.25`, or a value in that neighborhood, and every single one tested
so far has failed its confusor. A prior, separate investigation (predates this session, see the
comment above NURSE in `signs/index.ts`) already found and fixed the identical issue for NURSE,
DOCTOR, HOSPITAL, MEDICINE, and BREATHE (all bumped to 0.6). That's now **9 confirmed cases** of
the same root problem: `0.25` reads like a copy-pasted placeholder from early development that
was never actually calibrated against a real confusor, not a deliberately tuned value.

**What this does NOT mean**: it doesn't mean every remaining sign still at 0.25 is definitely
broken — DIZZY (0.34), FEVER (0.5), MORE (0.34) etc. were already given non-default values,
suggesting those *were* tuned. But every sign still sitting at the bare, untouched `0.25` is a
strong candidate and worth testing before trusting it. Candidates still at 0.25 as of this
writing (grep `minConfidence: 0.25` near a `movement:` line in `signs/index.ts`): **WANT, RED,
LETTER_P** (or whichever CONVERGE-type sign is at line ~319), **EMERGENCY**, **YELLOW**, and the
sign at line ~504 (fist-above-other-hand, LINEAR down — likely MORE or similar).

**Decision**: not bumping these blind. Bumping a threshold with no confusor data risks the
opposite failure — rejecting a real correct performance — which is just as bad as the bug we're
fixing, and CLAUDE.md's own rule says never approve/reject sign logic without measuring a rolling
window of real motion. Recommended next step: run each of the above through `/calibrate`
(record CORRECT + a confusor that fakes handshape/location but skips the real motion) and send the
CSV — same process as HELLO/PLEASE/THANK_YOU/YES, each fixed only after its own log proved it out.

\* PLEASE was at 0.44, not 0.25 — same underlying pattern (an under-tuned movement bar), different
starting number.

## 2026-07-14 — Conservative blanket bump for the remaining 0.25 defaults

User asked directly: given the 9/9 hit rate above, shouldn't every sign still at the stale 0.25
default just get bumped? Compromise taken: bump to 0.4 (the smallest value validated by any fix
above) as a safety-net floor, THEN run the full test suite — which replays real recorded correct
performances — as the actual validation, rather than trusting the number blind.

**Bumped 0.25 → 0.4**: WANT, EMERGENCY, NAME, RED, YELLOW, WIN. All 487 tests still passed
afterward, meaning each of these signs' real recorded fixture still clears 0.4 comfortably — no
confusor data yet, but no evidence of harm either.

**Reverted, NOT bumped**: PAIN. The blanket 0.4 broke a real fixture (`pain_real.json` — an actual
recorded correct performance) that only reaches ~0.25-0.39 confidence in its real CONVERGE motion.
Left at 0.25 with a comment explaining why, pending its own `/calibrate` confusor test to find a
real safe value (can't just guess a smaller bump without data — that's exactly the mistake this
whole log exists to avoid).

**Explicitly not touched**: HELP. Its `movement.minConfidence: 0.25` is a previously investigated,
deliberately accepted rule-based-v1 ceiling (see the comment above it and `signs/help.py`) — not
an oversight, so it wasn't included in the blanket bump.

**Caveat that still applies**: "all tests pass" only proves the bumped value doesn't break the
*specific* fixtures that exist today. It's not the same strength of evidence as an actual confusor
recording for each of these 6 signs — real testing is still worth doing when there's time, same as
HELLO/PLEASE/THANK_YOU/YES got.

## 2026-07-15 — Seven-sign `/calibrate` session (LETTER_E, MORE, DOCTOR, FEVER, HELP, HOSPITAL, EMERGENCY)

User ran the newly-landed `/calibrate` browser harness (`web/src/pages/CalibrationPage.tsx`) plus
plain-English notes, downloaded to `D:\Sign-Calibrations`. Findings and outcomes below; the CSVs
themselves can be deleted now that this entry is the durable record.

**LETTER_E — fixed, in two passes.** Note: "a simple fist shouldn't be accepted" / "letter F also
being accepted on a simple fist." `e_confidence`'s old check (high curl + thumb not extended)
can't tell E from a plain fist/S — both curl fully with the thumb tucked in; the confusor CSV
showed a fist scoring E's handshape at a perfect 1.0.

*First pass* used LETTER_S's fixture (~0.155 hand-scale units, thumb-tip-to-fingertip-midpoint
distance) as a stand-in for "fist" and an older LETTER_E recording (~0.44) as the target, with a
±0.15 tolerance band. All fixture-based tests passed — but the user reported it **still accepted
a real fist live**. The stand-in was the problem: LETTER_S isn't actually a good proxy for a
relaxed fist, and the tolerance was far wider than the real margin.

*Second pass*: recorded a DEDICATED correct-vs-fist confusor take
(`tools/recalibrate_letter_e.py`, same SPACE-to-record flow as the other `recalibrate_*` tools,
correct + confusor in one run) instead of reusing an unrelated fixture. Real numbers: genuine E
measures ~0.33-0.39 (median 0.361), a plain fist measures ~0.26-0.30 (median 0.292) — barely 0.02
apart at the closest edges, and BOTH well below the earlier 0.44 target. Retuned to
target=0.355/tolerance=0.05, which cleanly separates them (E's median-smoothed score ~0.80,
fist's ~0.0). Fixed in `core/handshape.py` + `web/src/engine/handshape.ts`; the synthesis preset
(`core/handshape_presets.py`) needed its own `_THUMB_TIP_E_UNDER`, recalibrated to match. Added a
permanent regression test (`TestLetterEFist` in `tests/test_specific_confusors.py` +
`web/tests/specific-confusors.test.ts`) using the new fixtures so this can't silently regress
again. All 445 Python + 498 TS tests pass.

**Lesson**: don't substitute a differently-purposed fixture (LETTER_S) for a confusor a sign
doesn't have real data for — record the actual confusor, the way every other fix in this log did.

**FEVER, HOSPITAL — fixed (same root cause).** Notes: "fever passes just when i bring my hand
closer to my forehead" / HOSPITAL "passes just by seeig my 2 fingers." Both have a LINEAR movement
with `direction=None` at a location the hand must travel TO (forehead / shoulder) — the REACH
itself is linear displacement, satisfying a magnitude-only check before the real motion (the sweep
/ the cross-stroke) ever happens. New `MovementReq.gate_to_location` restricts displacement
scoring to frames where the hand is already at the location, excluding the approach phase. Added
in `core/verifier.py` + `web/src/engine/verifier.ts`, applied to both signs. This is a different
bug class from HOSPITAL's already-documented rapid/random-movement ceiling below — it removes a
systematic false-credit source, not a magnitude-based confusor separator.

**EMERGENCY — fixed.** No user note, but the CSV showed `no_extra_hand` (TS-only param — a
Python/TS parity gap, now closed) scoring a genuine correct performance ~0.0 median: the original
presence-only check (any frame with a second detected hand counts against the sign) doesn't suit a
vigorous single-arm shake, which naturally causes some counterbalance motion in the idle arm.
Redesigned as motion-based (the OTHER hand's own path length, not mere presence) in both engines,
plus a new per-sign `Sign.extra_hand_motion_floor` override (EMERGENCY: 0.55, looser than the
0.30 default) since a resting-but-visible hand is normal webcam framing, not a real confusor.
`no_extra_hand` is now also implemented in `core/verifier.py` for the first time (previously
TS-only — signs like PLEASE/THANK_YOU had this protection in the web app but not in the Python
engine at all).

**DOCTOR — attempted, reverted.** Note: "doctor passes even on clapping." Hypothesis: a wrist-tap
only moves the dominant hand while the nondominant "wrist" stays still, so gating REPEATED
movement on the nondominant hand's own path length should reject clapping (which moves both).
Added `MovementReq.other_hand_max_motion_ratio=0.20` — but the real `doctor_correct.json` fixture
measured the nondominant hand's own path length at **0.90 shoulder-widths** over the 2s window, not
near-zero as assumed. A held-out arm apparently drifts/resettles enough on its own that raw path
length can't separate it from an actively clapping hand. Reverted in both engines rather than ship
a threshold that breaks real signing. Needs an actual recorded clap confusor to find a working
signal — flagging for a future `/calibrate` session, not closing it out as fixed.

**MORE, HELP — not touched, confirmed same pre-existing ceiling.** Notes: MORE "moving the hands
in the wrong direction also passes"; HELP "[should not] be accepted on random movement just by
seeing my thumbs up." Both are the SAME rule-based-v1 ceiling already investigated and documented
2026-07-14 (see MORE's and HELP's own comments in `signs/index.ts`/`signs/*.py`): magnitude/gap-
based movement checks structurally cannot separate a deliberate sign from vigorous undirected
motion — a real recorded rapid/random confusor's displacement measured AS LARGE OR LARGER than the
genuine sign's own motion for both. No new threshold or signal proposed here beats that already-
documented investigation. The ML classifier veto (`web/src/config/classifier.ts`, knownSigns
includes both) is the intended backstop — but **it only loads under `vite build` + `vite preview`,
not `npm run dev`** (see that file's `isClassifierDebugEnabled` comment), so this `/calibrate`
session and any `npm run dev` practice-mode testing never exercised it. Worth re-testing these two
specifically via a production preview build before assuming the backstop actually catches them.
