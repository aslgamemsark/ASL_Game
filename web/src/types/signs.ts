export type HandShapeKind =
  | 'fist' | 's' | 'a' | 'index' | 'open' | 'claw' | 'v' | 'l' | 'y' | 'w' | 'h' | 'n' | 'middle' | 'i'
  | 'd' | 'f' | 'o' | 't' | 'g' | 'letter_h' | 'k' | 'letter_n' | 'p' | 'q' | 'r' | 'u';

export type Anchor =
  | 'other_hand'
  | 'neutral_space'
  | 'chest'
  | 'chin'
  | 'forehead'
  | 'belly'
  | 'shoulder';

export type MovementKind = 'none' | 'linear' | 'circular' | 'repeated' | 'converge' | 'traced';

export type PalmFacing = 'up' | 'down' | 'forward' | 'back' | 'left' | 'right';

export interface HandShapeReq {
  kind: HandShapeKind;
  required: boolean;
  minConfidence: number;
}

export interface LocationReq {
  anchor: Anchor;
  actingHand: 'dominant' | 'nondominant';
  maxDistRatio: number;
  minDistRatio: number;
  vertical?: 'above' | 'below' | null;
  useClosestApproach?: boolean;
  required: boolean;
  minConfidence: number;
}

export interface MovementReq {
  kind: MovementKind;
  actor: 'dominant' | 'nondominant';
  pivot: 'dominant' | 'nondominant';
  minTotalRotationDeg?: number;
  radiusToleranceRatio?: number;
  direction?: [number, number];
  minDisplacementRatio?: number;
  minApproachRatio?: number;
  minCycles?: number;
  minAmplitudeRatio?: number;
  traceTemplate?: number[];
  traceToleranceDeg?: number;
  minDurationS: number;
  required: boolean;
}

export interface OrientationReq {
  hand: 'dominant' | 'nondominant';
  facing: PalmFacing;
  required: boolean;
}

export interface SignDef {
  name: string;
  twoHanded: boolean;
  dominant: HandShapeReq;
  nondominant?: HandShapeReq;
  location: LocationReq;
  movement: MovementReq;
  orientation?: OrientationReq;
  description: string;
  hint: string;
  clip?: string;
}
