/**
 * Minimal, dependency-free 3D math for skeleton discovery: TRS -> 4x4 matrix, matrix multiply,
 * matrix decomposition. Deliberately NOT importing three.js here — this module runs identically in
 * Node (for the CLI inspector / tests) and the browser, with zero DOM or WebGL dependency, per the
 * spec's rule that calibration/discovery code stays portable.
 *
 * All matrices are column-major length-16 arrays, matching glTF's `node.matrix` convention.
 */
import type { Quat, Vec3 } from './types.ts';

export type Mat4 = number[]; // length 16, column-major

export function identity(): Mat4 {
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function fromTRS(t: Vec3, r: Quat, s: Vec3): Mat4 {
  const { x, y, z, w } = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  // prettier-ignore
  return [
    (1 - (yy + zz)) * s.x, (xy + wz) * s.x, (xz - wy) * s.x, 0,
    (xy - wz) * s.y, (1 - (xx + zz)) * s.y, (yz + wx) * s.y, 0,
    (xz + wy) * s.z, (yz - wx) * s.z, (1 - (xx + yy)) * s.z, 0,
    t.x, t.y, t.z, 1,
  ];
}

/** Column-major 4x4 multiply: returns a*b (applies b first, then a — matches glTF/three.js convention). */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: number[] = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function getTranslation(m: Mat4): Vec3 {
  return { x: m[12], y: m[13], z: m[14] };
}

export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function vecLength(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vec3): Vec3 {
  const len = vecLength(v);
  if (len < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function quatIdentity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/**
 * Shortest-arc angular difference between two rotations, in degrees. Used by the Reference Pose
 * System to score solver output against a Blender ground-truth pose per bone. A unit quaternion and
 * its negation represent the SAME rotation (double cover), so this takes |dot| before the acos —
 * without that, a numerically-negated-but-identical rotation would incorrectly report ~180 degrees
 * of error.
 */
export function quatAngleDeg(a: Quat, b: Quat): number {
  const d = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  const clamped = Math.min(1, Math.max(-1, d));
  return (2 * Math.acos(clamped) * 180) / Math.PI;
}

/** Hamilton product a*b — applies b first, then a (matches glTF/three.js quaternion convention). */
export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Inverse (== conjugate for a unit quaternion). */
export function quatInvert(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function rotateVec3(v: Vec3, q: Quat): Vec3 {
  // t = 2 * cross(q.xyz, v); result = v + q.w * t + cross(q.xyz, t)
  const qv: Vec3 = { x: q.x, y: q.y, z: q.z };
  const t = scale(cross(qv, v), 2);
  const cr = cross(qv, t);
  return { x: v.x + q.w * t.x + cr.x, y: v.y + q.w * t.y + cr.y, z: v.z + q.w * t.z + cr.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Spherical linear interpolation between two rotations, shortest path. Negates `b` first if the
 * quaternions are on opposite hemispheres of the double cover (same rotation, different sign) —
 * without that, interpolation would take the LONG way around. Falls back to normalized linear
 * interpolation (nlerp) when the two rotations are nearly identical, since sin(theta) in the
 * standard slerp formula is unstable near theta=0 (division by ~0).
 */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  const tc = Math.min(1, Math.max(0, t));
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let cosHalfTheta = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (cosHalfTheta < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
    cosHalfTheta = -cosHalfTheta;
  }
  if (cosHalfTheta > 0.9995) {
    const x = a.x + (bx - a.x) * tc, y = a.y + (by - a.y) * tc, z = a.z + (bz - a.z) * tc, w = a.w + (bw - a.w) * tc;
    const len = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
    return { x: x / len, y: y / len, z: z / len, w: w / len };
  }
  const halfTheta = Math.acos(Math.min(1, Math.max(-1, cosHalfTheta)));
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - tc) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(tc * halfTheta) / sinHalfTheta;
  return {
    x: a.x * ratioA + bx * ratioB,
    y: a.y * ratioA + by * ratioB,
    z: a.z * ratioA + bz * ratioB,
    w: a.w * ratioA + bw * ratioB,
  };
}

/**
 * The shortest-arc rotation that takes unit vector `from` onto unit vector `to`. This is the core
 * primitive of the whole retargeting approach (spec: "quaternion(rest -> target)") — it never needs
 * to know anything about roll/twist around the vector's own axis, which is why Appendix A Rule 3
 * (never invent an unobservable rotation) is satisfiable without guessing bone twist.
 */
export function quatFromUnitVectors(from: Vec3, to: Vec3): Quat {
  const d = dot(from, to);
  if (d > 1 - 1e-9) return quatIdentity();
  if (d < -1 + 1e-9) {
    // 180-degree case: any axis perpendicular to `from` works. Pick a stable one.
    let axis = cross({ x: 1, y: 0, z: 0 }, from);
    if (vecLength(axis) < 1e-6) axis = cross({ x: 0, y: 1, z: 0 }, from);
    axis = normalize(axis);
    return { x: axis.x, y: axis.y, z: axis.z, w: 0 };
  }
  const axis = cross(from, to);
  const q: Quat = { x: axis.x, y: axis.y, z: axis.z, w: 1 + d };
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/**
 * Decompose a 4x4 column-major matrix into translation/rotation(quaternion)/scale. Standard
 * algorithm: translation is the last column; each axis's scale is the length of its column vector;
 * the rotation matrix is what remains after dividing each column by its scale, converted to a
 * quaternion via the trace-based method. Negative-determinant (mirrored) matrices are flagged rather
 * than silently mishandled — none of this project's avatars are expected to use negative scale.
 */
export function decompose(m: Mat4): { translation: Vec3; rotation: Quat; scale: Vec3; mirrored: boolean } {
  const translation: Vec3 = { x: m[12], y: m[13], z: m[14] };

  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);

  const det =
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[4] * (m[1] * m[10] - m[2] * m[9]) +
    m[8] * (m[1] * m[6] - m[2] * m[5]);
  const mirrored = det < 0;
  const sxSigned = mirrored ? -sx : sx;

  const invSx = sxSigned !== 0 ? 1 / sxSigned : 0;
  const invSy = sy !== 0 ? 1 / sy : 0;
  const invSz = sz !== 0 ? 1 / sz : 0;

  // prettier-ignore
  const r = [
    m[0] * invSx, m[1] * invSx, m[2] * invSx,
    m[4] * invSy, m[5] * invSy, m[6] * invSy,
    m[8] * invSz, m[9] * invSz, m[10] * invSz,
  ];

  const trace = r[0] + r[4] + r[8];
  let qx: number, qy: number, qz: number, qw: number;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (r[5] - r[7]) * s;
    qy = (r[6] - r[2]) * s;
    qz = (r[1] - r[3]) * s;
  } else if (r[0] > r[4] && r[0] > r[8]) {
    const s = 2.0 * Math.sqrt(1.0 + r[0] - r[4] - r[8]);
    qw = (r[5] - r[7]) / s;
    qx = 0.25 * s;
    qy = (r[3] + r[1]) / s;
    qz = (r[6] + r[2]) / s;
  } else if (r[4] > r[8]) {
    const s = 2.0 * Math.sqrt(1.0 + r[4] - r[0] - r[8]);
    qw = (r[6] - r[2]) / s;
    qx = (r[3] + r[1]) / s;
    qy = 0.25 * s;
    qz = (r[7] + r[5]) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + r[8] - r[0] - r[4]);
    qw = (r[1] - r[3]) / s;
    qx = (r[6] + r[2]) / s;
    qy = (r[7] + r[5]) / s;
    qz = 0.25 * s;
  }

  return {
    translation,
    rotation: { x: qx, y: qy, z: qz, w: qw },
    scale: { x: sxSigned, y: sy, z: sz },
    mirrored,
  };
}
