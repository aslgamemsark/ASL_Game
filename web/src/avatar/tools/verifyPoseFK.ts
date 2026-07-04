#!/usr/bin/env node
// Scratch verification script (not part of the pipeline): computes FK world positions for a set of
// key bones from a ReferencePoseMetadata JSON, to sanity-check a retargeted pose numerically when
// visual screenshot tooling is unavailable. Usage: npx tsx verifyPoseFK.ts <metadataJsonPath>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { fromTRS, multiply, getTranslation } from '../calibration/math3d.ts';

const REST_RIG_PATH = resolve(import.meta.dirname, '../../../public/models/avatar/ybot.glb');
const restRaw = readFileSync(REST_RIG_PATH);
const restBuffer = restRaw.buffer.slice(restRaw.byteOffset, restRaw.byteOffset + restRaw.byteLength);
const restHierarchy = buildHierarchy(parseGlb(restBuffer).json, REST_RIG_PATH);

const poseFile = process.argv[2];
const meta = JSON.parse(readFileSync(poseFile, 'utf-8'));

function worldMatrix(boneName: string, cache: Map<string, number[]>): number[] {
  const cached = cache.get(boneName);
  if (cached) return cached;
  const restBone = restHierarchy.bones[boneName];
  const poseBone = meta.bones[boneName];
  const t = poseBone ? poseBone.translation : [restBone.localPosition.x, restBone.localPosition.y, restBone.localPosition.z];
  const r = poseBone ? poseBone.rotation : [restBone.localRotation.x, restBone.localRotation.y, restBone.localRotation.z, restBone.localRotation.w];
  const s = restBone.localScale;
  const local = fromTRS({ x: t[0], y: t[1], z: t[2] }, { x: r[0], y: r[1], z: r[2], w: r[3] }, s);
  const parent = restBone.parent;
  const world = parent ? multiply(worldMatrix(parent, cache), local) : local;
  cache.set(boneName, world);
  return world;
}

const cache = new Map<string, number[]>();
for (const name of ['mixamorig:Hips', 'mixamorig:Spine2', 'mixamorig:Head', 'mixamorig:LeftFoot', 'mixamorig:RightFoot', 'mixamorig:RightHand', 'mixamorig:LeftHand']) {
  const w = worldMatrix(name, cache);
  const p = getTranslation(w);
  console.log(`${name}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`);
}
