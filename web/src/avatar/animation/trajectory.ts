/**
 * Procedural trajectory generators — port of the proven `core/trajectory.py` (git c46d570) used by
 * the earlier hand-authored avatar pipeline. Pure geometry, no rig/body knowledge: turns the same
 * MovementReq parameters the Python recognition verifier reads (kind, rotation amount, cycles) into
 * a concrete array of body-frame-relative points sampled over eased normalized time. Dependency-free
 * (no three.js) so it runs identically in Node tools/tests and the browser.
 */
import type { Vec3 } from '../calibration/types.ts';
import { add, normalize, scale, cross, subtract } from '../calibration/math3d.ts';

export type Easing = (u: number) => number;

export function easeLinear(u: number): number {
  return u;
}

/** Sine ease-in-out — smooth accel/decel, the default biological easing for authored signs. */
export function easeSineInOut(u: number): number {
  return 0.5 * (1 - Math.cos(Math.PI * Math.min(Math.max(u, 0), 1)));
}

export function normalizedTime(n: number, easing: Easing = easeSineInOut): number[] {
  const count = Math.max(n, 2);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(easing(i / (count - 1)));
  return out;
}

export function linearPath(start: Vec3, end: Vec3, n: number, easing: Easing = easeSineInOut): Vec3[] {
  const t = normalizedTime(n, easing);
  return t.map((u) => add(start, scale(subtract(end, start), u)));
}

/** Two orthonormal vectors spanning the plane with the given normal — the circle's own basis. */
function planeBasis(normalVec: Vec3): [Vec3, Vec3] {
  const n = normalize(normalVec);
  const seed: Vec3 = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const dotSeedN = seed.x * n.x + seed.y * n.y + seed.z * n.z;
  const u = normalize(subtract(seed, scale(n, dotSeedN)));
  const v = cross(n, u);
  return [u, v];
}

/**
 * Arc/circle of `totalRotationRad` radians about `pivot` in the plane `normal`. A full grind
 * (e.g. COFFEE) passes totalRotationRad >= 2*PI, matching MovementReq.min_total_rotation_deg.
 */
export function circularPath(
  pivot: Vec3,
  radius: number,
  totalRotationRad: number,
  n: number,
  normalVec: Vec3 = { x: 0, y: 0, z: 1 },
  startAngle = 0,
  easing: Easing = easeSineInOut
): Vec3[] {
  const [u, v] = planeBasis(normalVec);
  const t = normalizedTime(n, easing);
  return t.map((et) => {
    const theta = startAngle + totalRotationRad * et;
    return add(pivot, add(scale(u, radius * Math.cos(theta)), scale(v, radius * Math.sin(theta))));
  });
}

/** Repeated/tapping motion: `center` modulated along `axis` by a sine of `cycles` periods (HELLO wave). */
export function oscillationPath(center: Vec3, axisVec: Vec3, amplitude: number, cycles: number, n: number, phase = 0): Vec3[] {
  const axis = normalize(axisVec);
  const count = Math.max(n, 2);
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const offset = amplitude * Math.sin(2 * Math.PI * cycles * u + phase);
    out.push(add(center, scale(axis, offset)));
  }
  return out;
}
