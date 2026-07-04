/**
 * Reads a baked glTF animation clip (e.g. a Mixamo/Blender export with real per-frame keyframes,
 * not just a single static pose) and samples it at arbitrary normalized time. This is what lets a
 * "_complete" reference GLB with dozens of real keyframes (the actual wave in HELLO, say) feed the
 * Reference Pose System at full fidelity, instead of being collapsed to 2-3 sparse snapshots.
 *
 * Pure logic, no I/O — reused by extractBakedAnimation.ts (Node) and could run in the browser too.
 * Deliberately reads ONLY 'rotation' channels: this engine never animates bone translation/scale
 * (every consumer — ArmRetargeter, KeyframeAnimator — treats bone length/position as fixed from the
 * rest pose and only ever varies rotation), so translation/scale channels in a baked clip are
 * intentionally ignored, not silently dropped by omission.
 */
import type { GlTFAccessor, GlTFDocument } from '../calibration/glbBinary.ts';
import type { Quat } from '../calibration/types.ts';
import { slerp } from '../calibration/math3d.ts';

const FLOAT_COMPONENT_TYPE = 5126;
const COMPONENTS_PER_TYPE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Decodes an accessor's data into a flat number[] (row-major, `componentsPerElement` numbers per element). */
function readAccessorFloats(doc: GlTFDocument, binChunk: ArrayBuffer, accessorIndex: number): { values: number[]; componentsPerElement: number } {
  const accessor: GlTFAccessor | undefined = doc.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`No accessor at index ${accessorIndex}.`);
  if (accessor.componentType !== FLOAT_COMPONENT_TYPE) {
    throw new Error(`Accessor ${accessorIndex} has componentType ${accessor.componentType} — only FLOAT (5126) is supported by this baked-clip reader.`);
  }
  const componentsPerElement = COMPONENTS_PER_TYPE[accessor.type];
  if (!componentsPerElement) throw new Error(`Accessor ${accessorIndex} has unsupported type "${accessor.type}".`);
  if (accessor.bufferView === undefined) throw new Error(`Accessor ${accessorIndex} has no bufferView (sparse accessors are not supported).`);

  const bufferView = doc.bufferViews?.[accessor.bufferView];
  if (!bufferView) throw new Error(`No bufferView at index ${accessor.bufferView}.`);

  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const elementByteSize = componentsPerElement * 4;
  const stride = bufferView.byteStride ?? elementByteSize;

  const view = new DataView(binChunk);
  const values: number[] = [];
  for (let i = 0; i < accessor.count; i++) {
    const elementStart = byteOffset + i * stride;
    for (let c = 0; c < componentsPerElement; c++) {
      values.push(view.getFloat32(elementStart + c * 4, true));
    }
  }
  return { values, componentsPerElement };
}

export interface RotationTrack {
  times: number[]; // seconds, ascending
  rotations: Quat[]; // one per time
}

/** Builds a rotation track per animated bone (keyed by node NAME, matching this engine's convention everywhere else) for one animation clip. */
export function buildRotationTracks(doc: GlTFDocument, binChunk: ArrayBuffer, animationIndex = 0): Map<string, RotationTrack> {
  const animation = doc.animations?.[animationIndex];
  if (!animation) throw new Error(`No animation at index ${animationIndex} (document has ${doc.animations?.length ?? 0}).`);

  const tracks = new Map<string, RotationTrack>();
  for (const channel of animation.channels) {
    if (channel.target.path !== 'rotation') continue;
    const nodeName = doc.nodes?.[channel.target.node]?.name;
    if (!nodeName) continue;
    const sampler = animation.samplers[channel.sampler];
    const times = readAccessorFloats(doc, binChunk, sampler.input).values;
    const rotValues = readAccessorFloats(doc, binChunk, sampler.output);
    if (rotValues.componentsPerElement !== 4) {
      throw new Error(`Rotation output accessor for "${nodeName}" is not VEC4 (got ${rotValues.componentsPerElement} components).`);
    }
    const rotations: Quat[] = [];
    for (let i = 0; i < times.length; i++) {
      rotations.push({ x: rotValues.values[i * 4], y: rotValues.values[i * 4 + 1], z: rotValues.values[i * 4 + 2], w: rotValues.values[i * 4 + 3] });
    }
    tracks.set(nodeName, { times, rotations });
  }
  return tracks;
}

/** The time span (seconds) actually covered by a set of tracks — the true clip duration, never assumed. */
export function trackTimeRange(tracks: Map<string, RotationTrack>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const track of tracks.values()) {
    for (const t of track.times) {
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('No keyframe times found across any rotation track.');
  return { min, max };
}

/** SLERPs within one bone's track at absolute time `t` (seconds), clamping outside the track's own range. */
export function sampleTrackAtTime(track: RotationTrack, t: number): Quat {
  const { times, rotations } = track;
  if (t <= times[0]) return rotations[0];
  if (t >= times[times.length - 1]) return rotations[rotations.length - 1];
  for (let i = 0; i < times.length - 1; i++) {
    if (t < times[i] || t > times[i + 1]) continue;
    const span = times[i + 1] - times[i];
    const localT = span <= 1e-9 ? 0 : (t - times[i]) / span;
    return slerp(rotations[i], rotations[i + 1], localT);
  }
  return rotations[rotations.length - 1]; // unreachable given the clamps above
}

/** Samples every bone's track at normalized fraction `f` (0..1) across the clip's overall time range. */
export function sampleAllBonesAtFraction(tracks: Map<string, RotationTrack>, range: { min: number; max: number }, fraction: number): Map<string, Quat> {
  const t = range.min + (range.max - range.min) * Math.min(1, Math.max(0, fraction));
  const out = new Map<string, Quat>();
  for (const [boneName, track] of tracks) out.set(boneName, sampleTrackAtTime(track, t));
  return out;
}
