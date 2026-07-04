/**
 * Minimal GLB (binary glTF) container reader.
 *
 * Spec Ch.3: Skeleton Discovery must work by READING the file, never assuming structure. This
 * module only unpacks the two GLB chunks (JSON + optional BIN) — it does not interpret bones,
 * meshes, or animations. That interpretation belongs to SkeletonInspector.ts.
 *
 * GLB binary layout (https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format):
 *   header:  magic(u32) version(u32) length(u32)              = 12 bytes
 *   chunk0:  chunkLength(u32) chunkType(u32) chunkData         = JSON (chunkType 0x4E4F534A "JSON")
 *   chunk1:  chunkLength(u32) chunkType(u32) chunkData         = BIN  (chunkType 0x004E4942 "BIN\0"), optional
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_TYPE_JSON = 0x4e4f534a;
const CHUNK_TYPE_BIN = 0x004e4942;

export interface GlbParseResult {
  json: GlTFDocument;
  binChunk: ArrayBuffer | null;
}

/** Minimal glTF 2.0 document shape — only the fields the Avatar Engine actually reads. */
export interface GlTFNode {
  name?: string;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number]; // quaternion x,y,z,w
  scale?: [number, number, number];
  matrix?: number[]; // 16 elements, column-major — present instead of T/R/S on some exporters
  mesh?: number;
  skin?: number;
}

export interface GlTFSkin {
  joints: number[];
  inverseBindMatrices?: number;
  skeleton?: number;
}

export interface GlTFMeshPrimitive {
  targets?: Record<string, number>[];
}

export interface GlTFMesh {
  name?: string;
  primitives: GlTFMeshPrimitive[];
  extras?: { targetNames?: string[] };
}

export interface GlTFAnimationChannelTarget {
  node: number;
  path: 'translation' | 'rotation' | 'scale' | 'weights';
}

export interface GlTFAnimationChannel {
  sampler: number;
  target: GlTFAnimationChannelTarget;
}

export interface GlTFAnimationSampler {
  input: number; // accessor index — keyframe times (seconds)
  output: number; // accessor index — keyframe values (VEC3 for translation/scale, VEC4 for rotation)
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
}

export interface GlTFAnimation {
  name?: string;
  channels: GlTFAnimationChannel[];
  samplers: GlTFAnimationSampler[];
}

export interface GlTFAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number; // 5126 = FLOAT (the only type this engine's baked-clip reader supports)
  count: number;
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4';
  min?: number[];
  max?: number[];
}

export interface GlTFBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

export interface GlTFDocument {
  nodes?: GlTFNode[];
  skins?: GlTFSkin[];
  meshes?: GlTFMesh[];
  animations?: GlTFAnimation[];
  accessors?: GlTFAccessor[];
  bufferViews?: GlTFBufferView[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
}

export function parseGlb(buffer: ArrayBuffer): GlbParseResult {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error(`Not a GLB file: bad magic 0x${magic.toString(16)} (expected 0x${GLB_MAGIC.toString(16)})`);
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported glTF binary version ${version} (only version 2 is supported)`);
  }
  const totalLength = view.getUint32(8, true);
  if (totalLength > buffer.byteLength) {
    throw new Error(`GLB header declares length ${totalLength} but file is only ${buffer.byteLength} bytes`);
  }

  let offset = 12;
  let json: GlTFDocument | null = null;
  let binChunk: ArrayBuffer | null = null;

  while (offset < totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkData = buffer.slice(chunkStart, chunkStart + chunkLength);

    if (chunkType === CHUNK_TYPE_JSON) {
      const text = new TextDecoder('utf-8').decode(chunkData);
      json = JSON.parse(text) as GlTFDocument;
    } else if (chunkType === CHUNK_TYPE_BIN) {
      binChunk = chunkData;
    }
    // unknown chunk types are skipped per spec — forward compatible

    offset = chunkStart + chunkLength;
  }

  if (!json) {
    throw new Error('GLB file has no JSON chunk — cannot read skeleton');
  }
  return { json, binChunk };
}
