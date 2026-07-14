import { createSign, Anchor, MovementKind, PalmFacing, DOMINANT, NONDOMINANT } from '../schema';
import type { Sign } from '../schema';

export const COFFEE = createSign({
  name: 'COFFEE', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.9, vertical: 'above', required: true },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, pivot: NONDOMINANT, minTotalRotationDeg: 360, radiusToleranceRatio: 1.0, minDurationS: 0.6, required: true },
  orientation: { hand: DOMINANT, facing: PalmFacing.DOWN, required: false, minConfidence: 0.25},
});

export const HELLO = createSign({
  name: 'HELLO', twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false, minConfidence: 0.45},
  // minConfidence raised 0.25->0.6 (2026-07-14): real calibration log (HELLO_2026-07-14T18-01-57)
  // showed a tiny hand vibration sustained a 29-frame all-required-pass streak at 0.25 — well past
  // the app's 6-frame accept debounce, a genuine false accept. At 0.6 that same confusor's longest
  // run drops to 0, while the correct take's longest run stays a comfortable 88 frames (need only
  // 6). See docs/vault or the downloaded CSV for the full per-threshold sweep.
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.6, required: true, minConfidence: 0.6},
});

export const PLEASE = createSign({
  name: 'PLEASE', twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.CHEST, actingHand: DOMINANT, maxDistRatio: 0.45, required: true },
  // minConfidence raised 0.44->0.7 (2026-07-14): real calibration log (PLEASE_2026-07-14T18-19-02)
  // showed a loose/partial circular confusor motion sustained a 13-frame all-required-pass streak
  // at 0.44 — well past the app's 6-frame accept debounce, a genuine false accept. At 0.7 that same
  // confusor's longest run drops to 0, while the correct take's longest run stays a comfortable 130
  // frames (need only 6).
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, minTotalRotationDeg: 300, radiusToleranceRatio: 1.0, minDurationS: 0.6, required: true, minConfidence: 0.7},
  orientation: { hand: DOMINANT, facing: PalmFacing.IN, required: false, minConfidence: 0.25},
});

export const THANK_YOU = createSign({
  name: 'THANK_YOU', twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.2, minDurationS: 0.4, required: true, minConfidence: 0.25},
  orientation: { hand: DOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25},
});

export const WANT = createSign({
  name: 'WANT', twoHanded: true,
  dominant: { kind: 'open', required: true },
  nondominant: { kind: 'open', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.2, minDurationS: 0.4, required: true, minConfidence: 0.25},
});

export const YES = createSign({
  name: 'YES', twoHanded: false,
  dominant: { kind: 'fist', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false, minConfidence: 0.45},
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.6, required: true, minConfidence: 0.25},
});

export const MORE = createSign({
  name: 'MORE', twoHanded: true,
  // claw's floor (mean curl > 0.25) is tuned for MEDICINE/EMERGENCY's deeper bent-5; a real
  // flattened-O MORE take measured mean curl ~0.10-0.17, which claw reads as exactly 0.
  dominant: { kind: 'flat_o', required: true, minConfidence: 0.4 },
  nondominant: { kind: 'flat_o', required: true, minConfidence: 0.4 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, minApproachRatio: 0.15, minDurationS: 0.4, required: true },
});

export const YOU = createSign({
  name: 'YOU', twoHanded: false,
  dominant: { kind: 'point', required: true, minConfidence: 0.25},
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_A = createSign({
  name: 'LETTER_A', twoHanded: false,
  dominant: { kind: 'a', required: true },
  // location.required was true here (unlike the sibling letters below) with a tight 1.5
  // maxDistRatio. NEUTRAL_SPACE scoring halves the score whenever the hand is at/above the
  // shoulder line (verifier.ts::scoreLocation) — a common, natural hand height for
  // fingerspelling — capping it at 0.5, permanently below the 0.6 pass threshold. Matching the
  // other letters (required: false, maxDistRatio 3.0) since fingerspelling is a handshape sign,
  // not a positioning sign.
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_B = createSign({
  name: 'LETTER_B', twoHanded: false,
  dominant: { kind: 'b', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_L = createSign({
  name: 'LETTER_L', twoHanded: false,
  dominant: { kind: 'l', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_V = createSign({
  name: 'LETTER_V', twoHanded: false,
  dominant: { kind: 'v', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_Y = createSign({
  name: 'LETTER_Y', twoHanded: false,
  dominant: { kind: 'y', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_Z = createSign({
  name: 'LETTER_Z', twoHanded: false,
  dominant: { kind: 'index', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: {
    kind: MovementKind.TRACED, actor: DOMINANT,
    traceTemplate: [0, 135, 0], traceToleranceDeg: 60,
    minDisplacementRatio: 0.25, minDurationS: 0.6, required: true,
  },
});

export const LETTER_W = createSign({
  name: 'LETTER_W', twoHanded: false,
  dominant: { kind: 'w', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_I = createSign({
  name: 'LETTER_I', twoHanded: false,
  dominant: { kind: 'i', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_J = createSign({
  name: 'LETTER_J', twoHanded: false,
  dominant: { kind: 'i', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: {
    kind: MovementKind.TRACED, actor: DOMINANT,
    traceTemplate: [90, 180], traceToleranceDeg: 65,
    minDisplacementRatio: 0.20, minDurationS: 0.5, required: true,
  },
});

export const LETTER_D = createSign({
  name: 'LETTER_D', twoHanded: false,
  dominant: { kind: 'd', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_F = createSign({
  name: 'LETTER_F', twoHanded: false,
  dominant: { kind: 'f', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_O = createSign({
  name: 'LETTER_O', twoHanded: false,
  dominant: { kind: 'o', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_T = createSign({
  name: 'LETTER_T', twoHanded: false,
  dominant: { kind: 't', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_G = createSign({
  name: 'LETTER_G', twoHanded: false,
  dominant: { kind: 'g', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_H = createSign({
  name: 'LETTER_H', twoHanded: false,
  dominant: { kind: 'letter_h', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_K = createSign({
  name: 'LETTER_K', twoHanded: false,
  dominant: { kind: 'k', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_N = createSign({
  name: 'LETTER_N', twoHanded: false,
  dominant: { kind: 'letter_n', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_P = createSign({
  name: 'LETTER_P', twoHanded: false,
  // A real recorded P measured middle-finger extension at ~0.47 against the default 0.6
  // threshold — fully extending the middle finger while pointing downward is measurably harder
  // than the same K shape upright. Orientation/spread/thumb checks still reject a wrong-
  // orientation confusor, so lowering just this sign's threshold is safe.
  dominant: { kind: 'p', required: true, minConfidence: 0.4 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_Q = createSign({
  name: 'LETTER_Q', twoHanded: false,
  // A real recorded Q measured thumb-extension at ~0.48 against the default 0.6 threshold —
  // pointing the whole hand downward compresses how far the thumb reaches from the camera's
  // perspective. Orientation/index-extension checks still reject a wrong-orientation confusor.
  dominant: { kind: 'q', required: true, minConfidence: 0.4 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_R = createSign({
  name: 'LETTER_R', twoHanded: false,
  dominant: { kind: 'r', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_U = createSign({
  name: 'LETTER_U', twoHanded: false,
  dominant: { kind: 'u', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

// C/E/M/S/X were added to handshape.ts + data/signs.ts + alphabet.ts but never actually
// registered here, so ENGINE_SIGNS[id] was undefined for all five and the camera recognition
// loop never started regardless of handshape accuracy — this is the fix for "letters C/E/M/S/X
// aren't working" (2026-07), mirroring signs/letter_c.py etc. on the Python side.
export const LETTER_C = createSign({
  name: 'LETTER_C', twoHanded: false,
  dominant: { kind: 'c', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_E = createSign({
  name: 'LETTER_E', twoHanded: false,
  dominant: { kind: 'e', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_M = createSign({
  name: 'LETTER_M', twoHanded: false,
  dominant: { kind: 'm', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_S = createSign({
  name: 'LETTER_S', twoHanded: false,
  dominant: { kind: 'letter_s', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

export const LETTER_X = createSign({
  name: 'LETTER_X', twoHanded: false,
  dominant: { kind: 'x', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.NONE, required: false },
});

// --- Hospital signs ---

export const HELP = createSign({
  name: 'HELP', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.45 },
  // maxDistRatio 0.80 lets the lifted fist move higher before location fails
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.80, required: true, minConfidence: 0.44 },
  // direction re-added 2026-07-14: dropping it (as this file used to) made HELP magnitude-only,
  // and a real "hands present, not signing" recording found that's exploitable — natural settling
  // drift over the live 2.0s window cleared minConfidence=0.25 with no direction gate to reject
  // it, sustaining a false PASS. Verified against the same real recordings: WITH direction,
  // correct still clears the app's 6-frame debounce (streak 7, matching the Python engine's own
  // margin at this window size) while idle drops to 0. A real rapid/random-movement confusor
  // still passes (streak 12) — a documented rule-based-v1 ceiling, not something this fixes; see
  // signs/help.py in the Python engine for the parallel investigation. The classifier gate
  // (knownSigns includes HELP) is the backstop for that.
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, -1], minDisplacementRatio: 0.12, minDurationS: 0.3, minConfidence: 0.25, required: true },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25},
});

export const PAIN = createSign({
  name: 'PAIN', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'index', required: true, minConfidence: 0.25 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, minApproachRatio: 0.15, minDurationS: 0.4, required: true, minConfidence: 0.25},
});

export const MEDICINE = createSign({
  name: 'MEDICINE', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.50, required: true },
  // minCycles 2->3: recalibrated 2026-07-14 against real webcam takes, same investigation and
  // caveats as DOCTOR — see signs/medicine.py.
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 3, minDurationS: 0.6, required: true },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25},
});

export const EMERGENCY = createSign({
  name: 'EMERGENCY', twoHanded: false,
  dominant: { kind: 'claw', required: true, minConfidence: 0.50 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 3, minDurationS: 0.5, required: true, minConfidence: 0.25},
});

// DOCTOR/NURSE/SICK/HOSPITAL below all leave nondominant handshape unrequired — audited (2026-07)
// rather than changed. In real ASL these four are single-active-hand signs where the "other hand"
// is the resting forearm being tapped/pointed at, with no defined handshape of its own (unlike
// e.g. WRITE/READ/NAME/FRIEND, genuinely two-active-hand signs, which DO require nondominant
// shape). Absence of the second hand entirely is still blocked: the required OTHER_HAND location
// scores 0 with no second hand in frame at all (see scoreLocation), so this isn't "no second-hand
// check" — it's specifically "no shape check on a hand that ASL doesn't define a shape for." No
// fixture proves this is exploitable by an active/wrong-shaped second hand; left as-is rather than
// guessing, since tightening it risks a false-fail with no evidence it closes a real hole.
export const DOCTOR = createSign({
  name: 'DOCTOR', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.45 },
  nondominant: { kind: 'open', required: false },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.35, required: true },
  // minCycles 2->3: recalibrated 2026-07-14 against real webcam takes (correct DOCTOR vs.
  // rapid/random hand movement near the same spot) — see signs/doctor.py for the measured
  // separation. Reduces but does not eliminate a documented rule-based-v1 ceiling on this
  // confusor class; the classifier gate is the actual backstop (knownSigns includes DOCTOR).
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 3, minDurationS: 0.5, required: true },
});

export const NURSE = createSign({
  name: 'NURSE', twoHanded: true,
  dominant: { kind: 'n', required: true, minConfidence: 0.29 },
  nondominant: { kind: 'open', required: false },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.35, required: true },
  // minConfidence 0.25->0.6: recalibrated 2026-07-14 — a real recorded rapid/random-movement
  // confusor sustained a false PASS at the old, far-too-loose 0.25; 0.6 (matching DOCTOR/
  // HOSPITAL/MEDICINE/BREATHE) fully closes it while correct NURSE still clears easily. See
  // signs/nurse.py for the full investigation.
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.5, required: true, minConfidence: 0.6},
});

export const SICK = createSign({
  name: 'SICK', twoHanded: true,
  dominant: { kind: 'middle', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'middle', required: false, minConfidence: 0.25},
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.6, required: true, minConfidence: 0.25},
  movement: { kind: MovementKind.NONE, required: false },
});

export const FEVER = createSign({
  name: 'FEVER', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.7, required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, minDisplacementRatio: 0.18, minDurationS: 0.4, minConfidence: 0.5, required: true },
});

export const WATER = createSign({
  name: 'WATER', twoHanded: false,
  dominant: { kind: 'w', required: true, minConfidence: 0.25 },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true },
  movement: { kind: MovementKind.NONE, required: false },
});

export const BREATHE = createSign({
  name: 'BREATHE', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.CHEST, actingHand: DOMINANT, maxDistRatio: 0.6, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 1, minAmplitudeRatio: 0.12, minDurationS: 0.6, required: true },
});

export const HOSPITAL = createSign({
  name: 'HOSPITAL', twoHanded: true,
  dominant: { kind: 'h', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'open', required: false, minConfidence: 0.25},
  location: { anchor: Anchor.SHOULDER, actingHand: DOMINANT, maxDistRatio: 0.4, below: 'mouth', required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, minDisplacementRatio: 0.25, minDurationS: 0.5, required: true },
});

export const DIZZY = createSign({
  name: 'DIZZY', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.7, required: true },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, minTotalRotationDeg: 270, radiusToleranceRatio: 1.0, minDurationS: 0.6, required: true, minConfidence: 0.34},
});

// --- Classroom signs ---

export const TEACHER = createSign({
  name: 'TEACHER', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.8, required: true },
  // minCycles=1 was tried and reverted: a live test found that simply holding two hands still
  // near the forehead could score ~1 cycle from tracking jitter alone (near-face hand tracking is
  // noisy). 2 cycles sometimes needs a retry to register, but that's safer than passing on no motion.
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.08, minDurationS: 0.5, required: true, minConfidence: 0.4},
});

export const WRITE = createSign({
  name: 'WRITE', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.5, required: true },
  // minConfidence 0.45->0.8: recalibrated 2026-07-14 — a real "hands present, not signing"
  // recording sustained a false PASS at every value up to 0.7 (incidental settling read as a
  // low-amplitude "repeated" wiggle); 0.8 kills that while correct WRITE still clears with a wide
  // margin. See signs/write.py for the full investigation (rapid/random movement is only
  // partially addressed by this, not fully — a smaller, documented residual).
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.05, minDurationS: 0.5, required: true, minConfidence: 0.8},
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25},
});

export const READ = createSign({
  name: 'READ', twoHanded: true,
  dominant: { kind: 'v', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.6, required: true },
  // image-space down — camera-mirroring-independent, unlike left/right (see HELP's precedent for up).
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.25, minDurationS: 0.4, required: true, minConfidence: 0.34},
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25},
});

export const NAME = createSign({
  name: 'NAME', twoHanded: true,
  // A real recorded take measured the tapping hand's fingers naturally curling somewhat on
  // contact; the wrong-shape confusor scores 0.0 (huge margin), so 0.3 still rejects a genuinely
  // different handshape while tolerating in-motion blur on the moving hand. Only the dominant
  // (moving) hand gets this tolerance — a live test found loosening nondominant too let it hold
  // almost any shape, since that hand never moves and so never has an in-motion-blur excuse.
  dominant: { kind: 'h', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'h', required: true, minConfidence: 0.25 },
  // 0.4 gave full credit to hands merely hovering close — a live test found a double-tap could
  // pass without touching. A real recorded tap measured closest-approach down to ~0.01-0.06; 0.15
  // still clears genuine contact with margin while rejecting a near-miss hover.
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.15, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.04, minDurationS: 0.4, required: true, minConfidence: 0.25},
});

export const FRIEND = createSign({
  name: 'FRIEND', twoHanded: true,
  // 0.5 used to sit exactly on the boundary a genuinely curled ("hook") index finger scores
  // (index bent halfway + rest curled = 0.5 too), so a loosely closed hand read as a pass.
  dominant: { kind: 'index', required: true, minConfidence: 0.34 },
  nondominant: { kind: 'index', required: true, minConfidence: 0.59 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.35, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.05, minDurationS: 0.5, required: true, minConfidence: 0.35},
});

// --- World Cup event signs ---
// See signs/red.py, signs/yellow.py, signs/win.py, signs/team.py for the ASL-mechanics rationale
// (verified against Lifeprint/handspeak) and the same v1-approximation notes documented there.

export const RED = createSign({
  name: 'RED', twoHanded: false,
  dominant: { kind: 'index', required: true },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.2, minDurationS: 0.4, required: true, minConfidence: 0.25},
});

export const YELLOW = createSign({
  name: 'YELLOW', twoHanded: false,
  dominant: { kind: 'y', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false, minConfidence: 0.45},
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.6, required: true, minConfidence: 0.25},
});

export const WIN = createSign({
  name: 'WIN', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.9, vertical: 'above', required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, -1], minDisplacementRatio: 0.2, minDurationS: 0.4, required: true, minConfidence: 0.25},
});

export const TEAM = createSign({
  name: 'TEAM', twoHanded: true,
  dominant: { kind: 't', required: true },
  nondominant: { kind: 't', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, minApproachRatio: 0.15, minDurationS: 0.4, required: true },
});

export const COFFEE_SIGNS = [COFFEE, PLEASE, THANK_YOU, HELLO, WANT, YES, MORE, LETTER_A, LETTER_B, LETTER_C, LETTER_D, LETTER_E, LETTER_F, LETTER_G, LETTER_H, LETTER_I, LETTER_J, LETTER_K, LETTER_L, LETTER_M, LETTER_N, LETTER_O, LETTER_P, LETTER_Q, LETTER_R, LETTER_S, LETTER_T, LETTER_U, LETTER_V, LETTER_W, LETTER_X, LETTER_Y, LETTER_Z, YOU] as const;
export const HOSPITAL_SIGNS = [HELP, PAIN, MEDICINE, EMERGENCY, DOCTOR, NURSE, SICK, FEVER, WATER, BREATHE, HOSPITAL, DIZZY] as const;
export const CLASSROOM_SIGNS = [HELLO, PLEASE, THANK_YOU, TEACHER, WRITE, READ, NAME, FRIEND] as const;
export const WORLD_CUP_SIGNS = [RED, YELLOW, WIN, TEAM] as const;

export const SIGNS: Record<string, Sign> = {};
for (const s of [...COFFEE_SIGNS, ...HOSPITAL_SIGNS, ...CLASSROOM_SIGNS, ...WORLD_CUP_SIGNS]) {
  SIGNS[s.name] = s;
}
