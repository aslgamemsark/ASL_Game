/**
 * Hand-authored body-frame keyframe paths for the 3 benchmark signs — a direct port of the proven
 * `tools/author_signs.py` (git c46d570), which was the one avatar approach in this project's history
 * that reliably worked. Per the M5 architecture decision (see plan doc): arm/hand POSITION comes
 * from this authored path data (the Sign schema's Anchor + MovementKind translated into concrete
 * body-frame offsets), NOT from the real landmark dataset — that dataset has no elbow and no metric
 * depth, so it cannot support arm retargeting (Appendix A Rule 2: never invent missing information).
 *
 * Body frame convention (matches `BodyFrame.ts`): x = signer's right, y = up, z = forward (toward
 * camera), in units of shoulder-width, relative to an anchor bone.
 */
import type { Vec3 } from '../calibration/types.ts';

type Plane = 'xy' | 'xz' | 'yz';

interface CircleSpec {
  center: Vec3;
  radius: number;
  plane: Plane;
  turns: number;
}

interface KeyframedPath {
  keys: [number, Vec3][]; // (t in [0,1], body-frame position)
}

interface SignPathSpec {
  anchorJoint: string;
  durationS: number;
  domCircle?: CircleSpec;
  domPath?: KeyframedPath['keys'];
  ndomPath?: KeyframedPath['keys'];
  twoHanded: boolean;
  domShape: string;
  ndomShape?: string;
  palmFace: Vec3;
  palmFaceNondominant?: Vec3;
}

export const SIGN_PATHS: Record<string, SignPathSpec> = {
  HELLO: {
    anchorJoint: 'Head',
    durationS: 1.4,
    twoHanded: false,
    domShape: 'open',
    palmFace: { x: 0, y: 0.2, z: 1 },
    domPath: [
      [0.0, { x: 0.28, y: 0.18, z: 0.45 }],
      [1.0, { x: 0.62, y: 0.12, z: 0.55 }],
    ],
  },
  THANK_YOU: {
    anchorJoint: 'Head',
    durationS: 1.4,
    twoHanded: false,
    domShape: 'open',
    palmFace: { x: 0, y: 0.7, z: 0.7 },
    domPath: [
      [0.0, { x: 0.05, y: -0.35, z: 0.33 }],
      [1.0, { x: 0.12, y: -0.85, z: 0.62 }],
    ],
  },
  COFFEE: {
    anchorJoint: 'Spine1',
    durationS: 1.8,
    twoHanded: true,
    domShape: 'fist',
    ndomShape: 'fist',
    palmFace: { x: 0, y: -1, z: 0 },
    palmFaceNondominant: { x: 0, y: 1, z: 0 },
    domCircle: { center: { x: 0.0, y: 0.16, z: 0.5 }, radius: 0.1, plane: 'xz', turns: 2.0 },
    ndomPath: [[0.0, { x: 0.0, y: -0.04, z: 0.5 }]],
  },
};

const FPS = 30;

function smoothstep(a: Vec3, b: Vec3, n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const e = t * t * (3 - 2 * t);
    out.push({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: a.z + (b.z - a.z) * e });
  }
  return out;
}

function interpKeys(keys: [number, Vec3][], n: number): Vec3[] {
  if (keys.length === 1) return new Array(n).fill(keys[0][1]);
  const out: Vec3[] = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i];
    const [t1, p1] = keys[i + 1];
    const cnt = Math.max(2, Math.round((t1 - t0) * n));
    const pts = smoothstep(p0, p1, cnt);
    out.push(...(out.length === 0 ? pts : pts.slice(1)));
  }
  while (out.length < n) out.push(out[out.length - 1]);
  return out.slice(0, n);
}

/** Circle in one of the 3 cardinal planes, matching author_signs.py `_circle` exactly (incl. handedness). */
function circlePlane(center: Vec3, radius: number, plane: Plane, n: number, turns: number, start = -Math.PI / 2): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const ang = start + 2 * Math.PI * turns * (n === 1 ? 0 : i / (n - 1));
    let d: Vec3;
    if (plane === 'xz') d = { x: Math.cos(ang), y: 0, z: Math.sin(ang) };
    else if (plane === 'yz') d = { x: 0, y: Math.cos(ang), z: Math.sin(ang) };
    else d = { x: Math.cos(ang), y: Math.sin(ang), z: 0 };
    out.push({ x: center.x + radius * d.x, y: center.y + radius * d.y, z: center.z + radius * d.z });
  }
  return out;
}

export interface SignFrames {
  name: string;
  fps: number;
  frameCount: number;
  anchorJoint: string;
  twoHanded: boolean;
  dom: Vec3[]; // body-frame positions, one per frame
  ndom: Vec3[] | null;
  palmFace: Vec3;
  palmFaceNondominant: Vec3 | null;
}

export function buildSignFrames(name: keyof typeof SIGN_PATHS): SignFrames {
  const spec = SIGN_PATHS[name];
  if (!spec) throw new Error(`No authored path for sign "${name}". Available: ${Object.keys(SIGN_PATHS).join(', ')}`);
  const n = Math.max(Math.round(FPS * spec.durationS) + 1, 12);

  const dom = spec.domCircle
    ? circlePlane(spec.domCircle.center, spec.domCircle.radius, spec.domCircle.plane, n, spec.domCircle.turns)
    : interpKeys(spec.domPath!, n);

  const ndom = spec.twoHanded && spec.ndomPath ? interpKeys(spec.ndomPath, n) : null;

  return {
    name,
    fps: FPS,
    frameCount: n,
    anchorJoint: spec.anchorJoint,
    twoHanded: spec.twoHanded && ndom !== null,
    dom,
    ndom,
    palmFace: spec.palmFace,
    palmFaceNondominant: spec.palmFaceNondominant ?? null,
  };
}
