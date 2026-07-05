import { createSign, Anchor, MovementKind, PalmFacing, DOMINANT, NONDOMINANT } from '../schema';
import type { Sign } from '../schema';

export const COFFEE = createSign({
  name: 'COFFEE', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.9, vertical: 'above', required: true },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, pivot: NONDOMINANT, minTotalRotationDeg: 360, radiusToleranceRatio: 1.0, minDurationS: 0.6, required: true },
  orientation: { hand: DOMINANT, facing: PalmFacing.DOWN, required: false },
});

export const HELLO = createSign({
  name: 'HELLO', twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.6, required: true },
});

export const PLEASE = createSign({
  name: 'PLEASE', twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.CHEST, actingHand: DOMINANT, maxDistRatio: 0.45, required: true },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, minTotalRotationDeg: 300, radiusToleranceRatio: 1.0, minDurationS: 0.6, required: true },
  orientation: { hand: DOMINANT, facing: PalmFacing.IN, required: false },
});

export const THANK_YOU = createSign({
  name: 'THANK_YOU', twoHanded: false,
  dominant: { kind: 'open', required: true },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.2, minDurationS: 0.4, required: true },
  orientation: { hand: DOMINANT, facing: PalmFacing.UP, required: false },
});

export const WANT = createSign({
  name: 'WANT', twoHanded: true,
  dominant: { kind: 'open', required: true },
  nondominant: { kind: 'open', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.2, minDurationS: 0.4, required: true },
});

export const YES = createSign({
  name: 'YES', twoHanded: false,
  dominant: { kind: 'fist', required: true },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3.0, required: false },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.6, required: true },
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
  dominant: { kind: 'point', required: true },
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

// --- Hospital signs ---

export const HELP = createSign({
  name: 'HELP', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.45 },
  // maxDistRatio 0.80 lets the lifted fist move higher before location fails
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.80, required: true, minConfidence: 0.5 },
  // No direction: the net-displacement vector spans the full 2 s buffer including the
  // approach phase, which dilutes the upward component and kills dirScore. Removing the
  // direction check means any deliberate movement (lift, press, push) while fist is near
  // palm will pass — the two-handed position requirement is specific enough.
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, minDisplacementRatio: 0.12, minDurationS: 0.3, minConfidence: 0.45, required: true },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false },
});

export const PAIN = createSign({
  name: 'PAIN', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'index', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, minApproachRatio: 0.15, minDurationS: 0.4, required: true },
});

export const MEDICINE = createSign({
  name: 'MEDICINE', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.50, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.6, required: true },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false },
});

export const EMERGENCY = createSign({
  name: 'EMERGENCY', twoHanded: false,
  dominant: { kind: 'claw', required: true, minConfidence: 0.50 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 3, minDurationS: 0.5, required: true },
});

export const DOCTOR = createSign({
  name: 'DOCTOR', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.45 },
  nondominant: { kind: 'open', required: false },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.35, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.5, required: true },
});

export const NURSE = createSign({
  name: 'NURSE', twoHanded: true,
  dominant: { kind: 'n', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: false },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.35, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minDurationS: 0.5, required: true },
});

export const SICK = createSign({
  name: 'SICK', twoHanded: true,
  dominant: { kind: 'middle', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'middle', required: false },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.6, required: true },
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
  dominant: { kind: 'w', required: true, minConfidence: 0.55 },
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
  dominant: { kind: 'h', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: false },
  location: { anchor: Anchor.SHOULDER, actingHand: DOMINANT, maxDistRatio: 0.4, below: 'mouth', required: true },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, minDisplacementRatio: 0.25, minDurationS: 0.5, required: true },
});

export const DIZZY = createSign({
  name: 'DIZZY', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.7, required: true },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, minTotalRotationDeg: 270, radiusToleranceRatio: 1.0, minDurationS: 0.6, required: true },
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
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.08, minDurationS: 0.5, required: true },
});

export const WRITE = createSign({
  name: 'WRITE', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.5, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.05, minDurationS: 0.5, required: true },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false },
});

export const READ = createSign({
  name: 'READ', twoHanded: true,
  dominant: { kind: 'v', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.6, required: true },
  // image-space down — camera-mirroring-independent, unlike left/right (see HELP's precedent for up).
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, direction: [0, 1], minDisplacementRatio: 0.25, minDurationS: 0.4, required: true },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false },
});

export const NAME = createSign({
  name: 'NAME', twoHanded: true,
  // A real recorded take measured the tapping hand's fingers naturally curling somewhat on
  // contact; the wrong-shape confusor scores 0.0 (huge margin), so 0.3 still rejects a genuinely
  // different handshape while tolerating in-motion blur on the moving hand. Only the dominant
  // (moving) hand gets this tolerance — a live test found loosening nondominant too let it hold
  // almost any shape, since that hand never moves and so never has an in-motion-blur excuse.
  dominant: { kind: 'h', required: true, minConfidence: 0.3 },
  nondominant: { kind: 'h', required: true, minConfidence: 0.5 },
  // 0.4 gave full credit to hands merely hovering close — a live test found a double-tap could
  // pass without touching. A real recorded tap measured closest-approach down to ~0.01-0.06; 0.15
  // still clears genuine contact with margin while rejecting a near-miss hover.
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.15, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.04, minDurationS: 0.4, required: true },
});

export const FRIEND = createSign({
  name: 'FRIEND', twoHanded: true,
  // 0.5 used to sit exactly on the boundary a genuinely curled ("hook") index finger scores
  // (index bent halfway + rest curled = 0.5 too), so a loosely closed hand read as a pass.
  dominant: { kind: 'index', required: true, minConfidence: 0.65 },
  nondominant: { kind: 'index', required: true, minConfidence: 0.65 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, useClosestApproach: true, maxDistRatio: 0.35, required: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, minCycles: 2, minAmplitudeRatio: 0.05, minDurationS: 0.5, required: true },
});

export const COFFEE_SIGNS = [COFFEE, PLEASE, THANK_YOU, HELLO, WANT, YES, MORE, LETTER_A, LETTER_B, LETTER_I, LETTER_L, LETTER_V, LETTER_W, LETTER_Y, YOU] as const;
export const HOSPITAL_SIGNS = [HELP, PAIN, MEDICINE, EMERGENCY, DOCTOR, NURSE, SICK, FEVER, WATER, BREATHE, HOSPITAL, DIZZY] as const;
export const CLASSROOM_SIGNS = [HELLO, PLEASE, THANK_YOU, TEACHER, WRITE, READ, NAME, FRIEND] as const;

export const SIGNS: Record<string, Sign> = {};
for (const s of [...COFFEE_SIGNS, ...HOSPITAL_SIGNS, ...CLASSROOM_SIGNS]) {
  SIGNS[s.name] = s;
}
