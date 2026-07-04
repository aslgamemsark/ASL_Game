#!/usr/bin/env node
/** Milestone 3 CLI runner: load + validate every landmark fixture clip, print the spec's log trail. */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { loadClip, validateClip } from '../retarget/LandmarkLoader.ts';
import type { RawLandmarkClip } from '../retarget/landmarkTypes.ts';

const fixturesDir = resolve('src/avatar/tests/fixtures/landmarks');
const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

let allPass = true;
for (const file of files) {
  const path = join(fixturesDir, file);
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as RawLandmarkClip;
  const clip = loadClip(raw, path);
  const report = validateClip(clip);
  allPass &&= report.pass;

  console.log(`\n${file}`);
  console.log(`  sign: ${report.signName}  frames: ${report.frameCount}  ~fps: ${report.estimatedFps.toFixed(1)}`);
  console.log(`  hand coverage: ${report.framesWithAnyHand}/${report.frameCount} any-hand, ${report.framesWithBothHands}/${report.frameCount} both-hands`);
  console.log(`  missing pose: ${report.framesWithMissingPose}/${report.frameCount}`);
  console.log(`  longest missing-hand gap: left=${report.longestMissingHandGapFrames.left}f right=${report.longestMissingHandGapFrames.right}f`);
  console.log(`  tracking snaps flagged: ${report.possibleTrackingSnaps.length}`);
  console.log(`  malformed frames: ${report.malformedFrames.length}`);
  for (const m of report.malformedFrames.slice(0, 5)) console.log(`    - ${m}`);
  console.log(`  validation: ${report.pass ? 'PASS' : 'FAIL'}`);
}

console.log(`\nMilestone 3 acceptance (${files.length} fixture clips): ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
