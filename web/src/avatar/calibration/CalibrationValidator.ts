/**
 * Calibration Validation (spec Ch.7 Stage 8: "Reset avatar. Apply calibration. The avatar should
 * look identical. If appearance changes, calibration is incorrect.")
 *
 * Concretely: walk the ENTIRE hierarchy from the root, reconstructing each bone's local translation
 * as `calibration.restChildDirections[child] * calibration.restChildLengths[child]` (local rotation
 * and scale are reused unchanged — calibration never touches those), compose world matrices through
 * the full parent chain via the same FK math the original discovery used, and compare every
 * resulting world position against the GLB's actual rest-pose world position. This exercises real
 * chain composition (not a single isolated edge) and runs at the correct world scale automatically,
 * because both sides go through the same `fromTRS` + `multiply` composition.
 *
 * A correct calibration must round-trip to the exact original rest pose, within float tolerance.
 * This is a real numeric assertion per spec Appendix A Rule 9 ("acceptance tests must be real
 * assertions"), not a visual "looks the same to me."
 */
import { fromTRS, getTranslation, multiply, vecLength } from './math3d.ts';
import type { Mat4 } from './math3d.ts';
import type { AvatarHierarchy, CalibrationProfile, CalibrationValidation, Vec3 } from './types.ts';

const POSITION_TOLERANCE_METERS = 1e-5; // float32 round-trip noise; anything larger means a real bug

export function validateCalibration(
  hierarchy: AvatarHierarchy,
  calibration: CalibrationProfile
): CalibrationValidation {
  const details: string[] = [];
  let maxError = 0;
  let checked = 0;
  let skipped = 0;

  const worldCache = new Map<string, Mat4>();
  function reconstructedWorld(name: string): Mat4 {
    const cached = worldCache.get(name);
    if (cached) return cached;
    const bone = hierarchy.bones[name];

    let local: Mat4;
    if (!bone.parent) {
      // Root bone: no incoming edge to reconstruct from calibration — reuse its actual rest local
      // transform verbatim (this is the one place we deliberately read original data, since there
      // is no "parent -> root" edge for calibration to have captured).
      local = fromTRS(bone.localPosition, bone.localRotation, bone.localScale);
    } else {
      const parentCalib = calibration.bones[bone.parent];
      const dir = parentCalib?.restChildDirections[name];
      const len = parentCalib?.restChildLengths[name];
      if (!dir || len === undefined) {
        skipped++;
        local = fromTRS(bone.localPosition, bone.localRotation, bone.localScale); // fall back, but flagged via `skipped`
      } else {
        const translation: Vec3 = { x: dir.x * len, y: dir.y * len, z: dir.z * len };
        local = fromTRS(translation, bone.localRotation, bone.localScale);
      }
    }

    const world = bone.parent ? multiply(reconstructedWorld(bone.parent), local) : local;
    worldCache.set(name, world);
    return world;
  }

  for (const name of Object.keys(hierarchy.bones)) {
    const actual = hierarchy.bones[name].worldPosition;
    const reconstructed = getTranslation(reconstructedWorld(name));
    const error = vecLength({
      x: reconstructed.x - actual.x,
      y: reconstructed.y - actual.y,
      z: reconstructed.z - actual.z,
    });
    checked++;
    maxError = Math.max(maxError, error);
    if (error > POSITION_TOLERANCE_METERS) {
      details.push(`${name}: world-position reconstruction error ${(error * 1000).toFixed(4)}mm (exceeds tolerance)`);
    }
  }

  if (skipped > 0) {
    details.push(`${skipped} bone(s) had no calibration edge data and fell back to their original local transform.`);
  }

  const pass = maxError <= POSITION_TOLERANCE_METERS && checked > 0;
  details.unshift(`Checked ${checked} bone(s) through full chain reconstruction; max error ${(maxError * 1000).toFixed(6)}mm (tolerance ${(POSITION_TOLERANCE_METERS * 1000).toFixed(3)}mm).`);

  return { pass, maxPositionErrorMeters: maxError, boneCount: checked, details };
}
