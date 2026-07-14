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
