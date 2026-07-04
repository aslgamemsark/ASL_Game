#!/usr/bin/env node
/** Milestone 2 CLI runner: discovery -> calibration -> validation -> calibration.json. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { validateCalibration } from '../calibration/CalibrationValidator.ts';

const inputPath = resolve(process.argv[2] ?? 'public/models/avatar/ybot.glb');
const outputPath = resolve('src/avatar/calibration/output/calibration.json');

function log(step: string, ok: boolean, detail?: string) {
  console.log(`${step}... ${ok ? 'PASS' : 'FAIL'}${detail ? `  (${detail})` : ''}`);
}

const raw = readFileSync(inputPath);
const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
log('Loading avatar', true, inputPath);

const { json } = parseGlb(buffer);
const hierarchy = buildHierarchy(json, inputPath);
log('Analyzing skeleton', true, `${hierarchy.totalBones} bones`);

const calibration = buildCalibration(hierarchy, buffer);
log('Bone rolls / rest directions', true, `${Object.keys(calibration.bones).length} bones calibrated`);
log('Wrist + palm calibration', calibration.hands.left.palmRestNormalLocal !== null && calibration.hands.right.palmRestNormalLocal !== null);
log('Shoulder width scale', calibration.shoulderWidthMeters > 0, `${(calibration.shoulderWidthMeters * 100).toFixed(1)}cm`);

const validation = validateCalibration(hierarchy, calibration);
log('Calibration round-trip validation', validation.pass, `max error ${(validation.maxPositionErrorMeters * 1000).toFixed(6)}mm over ${validation.boneCount} bones`);
for (const d of validation.details) console.log(`  - ${d}`);

writeFileSync(outputPath, JSON.stringify(calibration, null, 2), 'utf-8');
log('Exporting calibration.json', true, outputPath);

if (calibration.notes.length > 0) {
  console.log(`\n${calibration.notes.length} note(s):`);
  for (const n of calibration.notes) console.log(`  - ${n}`);
}

console.log(`\nMilestone 2 acceptance: ${validation.pass ? 'PASS' : 'FAIL'}`);
process.exit(validation.pass ? 0 : 1);
