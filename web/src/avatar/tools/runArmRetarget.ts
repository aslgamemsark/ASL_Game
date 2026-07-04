#!/usr/bin/env node
/** Milestone 5 CLI runner: discovery -> calibration -> arm IK for the 3 benchmark signs. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { retargetSign } from '../animation/ArmRetargeter.ts';
import { SIGN_PATHS } from '../animation/signPaths.ts';

const inputPath = resolve(process.argv[2] ?? 'public/models/avatar/ybot.glb');
const POSITION_TOLERANCE_METERS = 0.005; // 5mm — reachable IK targets should land essentially exactly

function log(step: string, ok: boolean, detail?: string) {
  console.log(`${step}... ${ok ? 'PASS' : 'FAIL'}${detail ? `  (${detail})` : ''}`);
}

const raw = readFileSync(inputPath);
const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const { json } = parseGlb(buffer);
const hierarchy = buildHierarchy(json, inputPath);
const calibration = buildCalibration(hierarchy, buffer);
log('Loading + calibrating avatar', true, `${hierarchy.totalBones} bones`);

let overallPass = true;
const report: Record<string, unknown> = {};

for (const signName of Object.keys(SIGN_PATHS) as (keyof typeof SIGN_PATHS)[]) {
  const result = retargetSign(hierarchy, calibration, signName);
  const pass = result.maxPositionErrorMeters <= POSITION_TOLERANCE_METERS;
  overallPass &&= pass;
  log(
    `${signName}: ${result.frames.length} frames retargeted`,
    pass,
    `max err ${(result.maxPositionErrorMeters * 1000).toFixed(2)}mm, mean ${(result.meanPositionErrorMeters * 1000).toFixed(2)}mm`
  );
  report[signName] = {
    frameCount: result.frames.length,
    fps: result.fps,
    maxPositionErrorMeters: result.maxPositionErrorMeters,
    meanPositionErrorMeters: result.meanPositionErrorMeters,
    pass,
  };
}

const outputPath = resolve('src/avatar/animation/output/armRetargetReport.json');
writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
log('Exporting armRetargetReport.json', true, outputPath);

console.log(`\nMilestone 5 acceptance (hand reaches target within ${POSITION_TOLERANCE_METERS * 1000}mm): ${overallPass ? 'PASS' : 'FAIL'}`);
process.exit(overallPass ? 0 : 1);
