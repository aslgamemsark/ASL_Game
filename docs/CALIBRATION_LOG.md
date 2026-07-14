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
