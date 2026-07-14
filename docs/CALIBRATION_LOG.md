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

## 2026-07-14 — THANK_YOU: no bug found, no fix made

**Log**: `THANK_YOU_2026-07-14T18-22...csv` (x2, duplicate download of the same take) + note
"movement threshold too low, hand on chin instantly passes".

**Finding**: data contradicts the note. Confusor phase never sustains a pass streak (0 frames).
Correct-phase movement param only clears its threshold 20% of the time (most of the recording is
resting between reps, correctly reading as not-yet-passed) — the opposite of an instant-pass bug.

**Status**: left unfixed — no threshold changed. Pending clarification on whether the described
behavior happened inside `/calibrate` or elsewhere (a real lesson uses a different code path).
