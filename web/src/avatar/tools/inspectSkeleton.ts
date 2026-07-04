#!/usr/bin/env node
/**
 * Milestone 1 CLI runner: load ybot.glb from disk (no browser needed), run Skeleton Discovery,
 * write avatarHierarchy.json, and print the spec's required PASS/FAIL log trail (Ch.2 "Logging" /
 * Ch.3 "Required Output").
 *
 * Usage: npx tsx src/avatar/tools/inspectSkeleton.ts [path/to/avatar.glb]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';

const inputPath = resolve(process.argv[2] ?? 'public/models/avatar/ybot.glb');
const outputPath = resolve('src/avatar/calibration/output/avatarHierarchy.json');

function log(step: string, ok: boolean, detail?: string) {
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${step}... ${status}${detail ? `  (${detail})` : ''}`);
}

console.log(`Loading avatar from ${inputPath}`);
let buffer: ArrayBuffer;
try {
  const raw = readFileSync(inputPath);
  buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  log('Loading avatar', true, `${(raw.byteLength / 1024 / 1024).toFixed(2)} MB`);
} catch (e) {
  log('Loading avatar', false, (e as Error).message);
  process.exit(1);
}

let doc;
try {
  doc = parseGlb(buffer).json;
  log('Parsing GLB container', true, `${doc.nodes?.length ?? 0} nodes`);
} catch (e) {
  log('Parsing GLB container', false, (e as Error).message);
  process.exit(1);
}

const hierarchy = buildHierarchy(doc, inputPath);
log('Analyzing skeleton', true, `${hierarchy.totalBones} bones discovered`);

const armsOk = (['left', 'right'] as const).every(
  (s) => hierarchy.arms[s].upperArm && hierarchy.arms[s].forearm && hierarchy.arms[s].hand
);
log('Arm chains (both sides)', armsOk);

const fingersOk = (['left', 'right'] as const).every((s) =>
  (['thumb', 'index', 'middle', 'ring', 'pinky'] as const).every(
    (f) => (hierarchy.hands[s].fingers[f]?.length ?? 0) >= 3
  )
);
log('Finger chains (5 per hand, both sides)', fingersOk);

log('Spine chain', hierarchy.spine.length > 0, `${hierarchy.spine.length} segments`);
log('Root bone', Boolean(hierarchy.root), hierarchy.root ?? 'NOT FOUND');
log('Head bone', Boolean(hierarchy.head), hierarchy.head ?? 'NOT FOUND');

writeFileSync(outputPath, JSON.stringify(hierarchy, null, 2), 'utf-8');
log('Exporting avatarHierarchy.json', true, outputPath);

if (hierarchy.warnings.length > 0) {
  console.log(`\n${hierarchy.warnings.length} warning(s):`);
  for (const w of hierarchy.warnings) console.log(`  - ${w}`);
}
if (hierarchy.unclassified.length > 0) {
  console.log(`\n${hierarchy.unclassified.length} unclassified node(s) (not bone-relevant, e.g. legs/feet):`);
  for (const n of hierarchy.unclassified) console.log(`  - ${n}`);
}

const overallPass = armsOk && fingersOk && Boolean(hierarchy.root) && Boolean(hierarchy.head);
console.log(`\nMilestone 1 acceptance: ${overallPass ? 'PASS' : 'FAIL'}`);
process.exit(overallPass ? 0 : 1);
