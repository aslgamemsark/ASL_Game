// GENERATED FILE — DO NOT EDIT MANUALLY
// Source: tools/generate_sign_jsons.py → signs/*.json → this file
// Regenerate with: npx tsx tools/generate_engine_signs.ts

import { createSign, Anchor, MovementKind, PalmFacing, DOMINANT, NONDOMINANT } from '../schema';
import type { Sign } from '../schema';

export const BREATHE = createSign({
  name: 'BREATHE', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.CHEST, actingHand: DOMINANT, maxDistRatio: 0.6, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.6, minCycles: 1, minAmplitudeRatio: 0.12 },
});
export const COFFEE = createSign({
  name: 'COFFEE', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.9, required: true, minConfidence: 0.6, vertical: 'above' },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.6, minTotalRotationDeg: 360, radiusToleranceRatio: 1 },
  orientation: { hand: DOMINANT, facing: PalmFacing.DOWN, required: false, minConfidence: 0.25 },
});
export const DIZZY = createSign({
  name: 'DIZZY', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.7, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.34, minTotalRotationDeg: 270, radiusToleranceRatio: 1 },
});
export const DOCTOR = createSign({
  name: 'DOCTOR', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.45 },
  nondominant: { kind: 'open', required: false, minConfidence: 0.6 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.35, required: true, minConfidence: 0.6, useClosestApproach: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.6, minCycles: 3, minAmplitudeRatio: 0.05 },
});
export const EMERGENCY = createSign({
  name: 'EMERGENCY', twoHanded: false,
  extraHandMotionFloor: 0.55,
  dominant: { kind: 'claw', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.25, minCycles: 3, minAmplitudeRatio: 0.05 },
});
export const FEVER = createSign({
  name: 'FEVER', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.7, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.5, minDisplacementRatio: 0.18, gateToLocation: true },
});
export const FRIEND = createSign({
  name: 'FRIEND', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.34 },
  nondominant: { kind: 'index', required: true, minConfidence: 0.59 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.35, required: true, minConfidence: 0.6, useClosestApproach: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.35, minCycles: 2, minAmplitudeRatio: 0.05 },
});
export const HELLO = createSign({
  name: 'HELLO', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.45 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.25, minCycles: 2, minAmplitudeRatio: 0.05 },
});
export const HELP = createSign({
  name: 'HELP', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.45 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.8, required: true, minConfidence: 0.44 },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.3, required: true, minConfidence: 0.25, direction: [0, -1] as [number, number], minDisplacementRatio: 0.12 },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25 },
});
export const HOSPITAL = createSign({
  name: 'HOSPITAL', twoHanded: true,
  dominant: { kind: 'h', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'open', required: false, minConfidence: 0.25 },
  location: { anchor: Anchor.SHOULDER, actingHand: DOMINANT, maxDistRatio: 0.4, required: true, minConfidence: 0.6, below: 'mouth' },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.6, minDisplacementRatio: 0.25, gateToLocation: true },
});
export const LETTER_A = createSign({
  name: 'LETTER_A', twoHanded: false,
  dominant: { kind: 'A', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_B = createSign({
  name: 'LETTER_B', twoHanded: false,
  dominant: { kind: 'b', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_C = createSign({
  name: 'LETTER_C', twoHanded: false,
  dominant: { kind: 'c', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_D = createSign({
  name: 'LETTER_D', twoHanded: false,
  dominant: { kind: 'd', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_E = createSign({
  name: 'LETTER_E', twoHanded: false,
  dominant: { kind: 'e', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_F = createSign({
  name: 'LETTER_F', twoHanded: false,
  dominant: { kind: 'f', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_G = createSign({
  name: 'LETTER_G', twoHanded: false,
  dominant: { kind: 'g', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_H = createSign({
  name: 'LETTER_H', twoHanded: false,
  dominant: { kind: 'letter_h', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_I = createSign({
  name: 'LETTER_I', twoHanded: false,
  dominant: { kind: 'i', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_J = createSign({
  name: 'LETTER_J', twoHanded: false,
  dominant: { kind: 'i', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.TRACED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.6, traceTemplate: [90, 180], traceToleranceDeg: 65, minDisplacementRatio: 0.2 },
});
export const LETTER_K = createSign({
  name: 'LETTER_K', twoHanded: false,
  dominant: { kind: 'k', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_L = createSign({
  name: 'LETTER_L', twoHanded: false,
  dominant: { kind: 'l', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_M = createSign({
  name: 'LETTER_M', twoHanded: false,
  dominant: { kind: 'm', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_N = createSign({
  name: 'LETTER_N', twoHanded: false,
  dominant: { kind: 'letter_n', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_O = createSign({
  name: 'LETTER_O', twoHanded: false,
  dominant: { kind: 'o', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_P = createSign({
  name: 'LETTER_P', twoHanded: false,
  dominant: { kind: 'p', required: true, minConfidence: 0.4 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_Q = createSign({
  name: 'LETTER_Q', twoHanded: false,
  dominant: { kind: 'q', required: true, minConfidence: 0.4 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_R = createSign({
  name: 'LETTER_R', twoHanded: false,
  dominant: { kind: 'r', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_S = createSign({
  name: 'LETTER_S', twoHanded: false,
  dominant: { kind: 'letter_s', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_T = createSign({
  name: 'LETTER_T', twoHanded: false,
  dominant: { kind: 't', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_U = createSign({
  name: 'LETTER_U', twoHanded: false,
  dominant: { kind: 'u', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_V = createSign({
  name: 'LETTER_V', twoHanded: false,
  dominant: { kind: 'v', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_W = createSign({
  name: 'LETTER_W', twoHanded: false,
  dominant: { kind: 'w', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_X = createSign({
  name: 'LETTER_X', twoHanded: false,
  dominant: { kind: 'x', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_Y = createSign({
  name: 'LETTER_Y', twoHanded: false,
  dominant: { kind: 'y', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const LETTER_Z = createSign({
  name: 'LETTER_Z', twoHanded: false,
  dominant: { kind: 'index', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.TRACED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.6, traceTemplate: [0, 135, 0], traceToleranceDeg: 60, minDisplacementRatio: 0.25 },
});
export const MEDICINE = createSign({
  name: 'MEDICINE', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.55 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.55 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.5, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.6, minCycles: 3, minAmplitudeRatio: 0.05 },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25 },
});
export const MORE = createSign({
  name: 'MORE', twoHanded: true,
  dominant: { kind: 'flat_o', required: true, minConfidence: 0.4 },
  nondominant: { kind: 'flat_o', required: true, minConfidence: 0.4 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.6, minApproachRatio: 0.15 },
});
export const NAME = createSign({
  name: 'NAME', twoHanded: true,
  dominant: { kind: 'h', required: true, minConfidence: 0.3 },
  nondominant: { kind: 'h', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.15, required: true, minConfidence: 0.6, useClosestApproach: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.6, minCycles: 2, minAmplitudeRatio: 0.04 },
});
export const NURSE = createSign({
  name: 'NURSE', twoHanded: true,
  dominant: { kind: 'n', required: true, minConfidence: 0.29 },
  nondominant: { kind: 'open', required: false, minConfidence: 0.6 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.35, required: true, minConfidence: 0.6, useClosestApproach: true },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.6, minCycles: 2, minAmplitudeRatio: 0.05 },
});
export const PAIN = createSign({
  name: 'PAIN', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'index', required: true, minConfidence: 0.25 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.25, minApproachRatio: 0.15 },
});
export const PLEASE = createSign({
  name: 'PLEASE', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.CHEST, actingHand: DOMINANT, maxDistRatio: 0.45, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.CIRCULAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.44, minTotalRotationDeg: 300, radiusToleranceRatio: 1 },
  orientation: { hand: DOMINANT, facing: PalmFacing.IN, required: false, minConfidence: 0.25 },
});
export const READ = createSign({
  name: 'READ', twoHanded: true,
  dominant: { kind: 'v', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.6, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.34, direction: [0, 1] as [number, number], minDisplacementRatio: 0.25 },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25 },
});
export const RED = createSign({
  name: 'RED', twoHanded: false,
  dominant: { kind: 'index', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.25, direction: [0, 1] as [number, number], minDisplacementRatio: 0.2 },
});
export const SICK = createSign({
  name: 'SICK', twoHanded: true,
  dominant: { kind: 'middle', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'middle', required: false, minConfidence: 0.25 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.6, required: true, minConfidence: 0.25 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const TEACHER = createSign({
  name: 'TEACHER', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.FOREHEAD, actingHand: DOMINANT, maxDistRatio: 0.8, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.4, minCycles: 2, minAmplitudeRatio: 0.08 },
});
export const TEAM = createSign({
  name: 'TEAM', twoHanded: true,
  dominant: { kind: 't', required: true, minConfidence: 0.6 },
  nondominant: { kind: 't', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 1.5, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.CONVERGE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.6, minApproachRatio: 0.15 },
});
export const THANK_YOU = createSign({
  name: 'THANK_YOU', twoHanded: false,
  dominant: { kind: 'open', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.85, direction: [0, 1] as [number, number], minDisplacementRatio: 0.2 },
  orientation: { hand: DOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25 },
});
export const WANT = createSign({
  name: 'WANT', twoHanded: true,
  dominant: { kind: 'open', required: true, minConfidence: 0.6 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.25, direction: [0, 1] as [number, number], minDisplacementRatio: 0.2 },
});
export const WATER = createSign({
  name: 'WATER', twoHanded: false,
  dominant: { kind: 'w', required: true, minConfidence: 0.25 },
  location: { anchor: Anchor.CHIN, actingHand: DOMINANT, maxDistRatio: 0.5, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});
export const WIN = createSign({
  name: 'WIN', twoHanded: true,
  dominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  nondominant: { kind: 'fist', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.9, required: true, minConfidence: 0.6, vertical: 'above' },
  movement: { kind: MovementKind.LINEAR, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.4, required: true, minConfidence: 0.25, direction: [0, -1] as [number, number], minDisplacementRatio: 0.2 },
});
export const WRITE = createSign({
  name: 'WRITE', twoHanded: true,
  dominant: { kind: 'index', required: true, minConfidence: 0.25 },
  nondominant: { kind: 'open', required: true, minConfidence: 0.5 },
  location: { anchor: Anchor.OTHER_HAND, actingHand: DOMINANT, maxDistRatio: 0.5, required: true, minConfidence: 0.6 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.5, required: true, minConfidence: 0.8, minCycles: 2, minAmplitudeRatio: 0.05 },
  orientation: { hand: NONDOMINANT, facing: PalmFacing.UP, required: false, minConfidence: 0.25 },
});
export const YELLOW = createSign({
  name: 'YELLOW', twoHanded: false,
  dominant: { kind: 'y', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.45 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.25, minCycles: 2, minAmplitudeRatio: 0.05 },
});
export const YES = createSign({
  name: 'YES', twoHanded: false,
  dominant: { kind: 'fist', required: true, minConfidence: 0.6 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.45 },
  movement: { kind: MovementKind.REPEATED, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: true, minConfidence: 0.25, minCycles: 2, minAmplitudeRatio: 0.05 },
});
export const YOU = createSign({
  name: 'YOU', twoHanded: false,
  dominant: { kind: 'point', required: true, minConfidence: 0.25 },
  location: { anchor: Anchor.NEUTRAL_SPACE, actingHand: DOMINANT, maxDistRatio: 3, required: false, minConfidence: 0.6 },
  movement: { kind: MovementKind.NONE, actor: DOMINANT, pivot: NONDOMINANT, minDurationS: 0.6, required: false, minConfidence: 0.6 },
});

export const COFFEE_SIGNS = [COFFEE, PLEASE, THANK_YOU, HELLO, WANT, YES, MORE, LETTER_A, LETTER_B, LETTER_C, LETTER_D, LETTER_E, LETTER_F, LETTER_G, LETTER_H, LETTER_I, LETTER_J, LETTER_K, LETTER_L, LETTER_M, LETTER_N, LETTER_O, LETTER_P, LETTER_Q, LETTER_R, LETTER_S, LETTER_T, LETTER_U, LETTER_V, LETTER_W, LETTER_X, LETTER_Y, LETTER_Z, YOU] as const;
export const HOSPITAL_SIGNS = [HELP, PAIN, MEDICINE, EMERGENCY, DOCTOR, NURSE, SICK, FEVER, WATER, BREATHE, HOSPITAL, DIZZY] as const;
export const CLASSROOM_SIGNS = [HELLO, PLEASE, THANK_YOU, TEACHER, WRITE, READ, NAME, FRIEND] as const;
export const WORLD_CUP_SIGNS = [RED, YELLOW, WIN, TEAM] as const;

export const SIGNS: Record<string, Sign> = {};
for (const s of [...COFFEE_SIGNS, ...HOSPITAL_SIGNS, ...CLASSROOM_SIGNS, ...WORLD_CUP_SIGNS]) {
  SIGNS[s.name] = s;
}
