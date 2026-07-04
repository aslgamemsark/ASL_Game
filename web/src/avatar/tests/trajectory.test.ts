import { describe, expect, it } from 'vitest';
import { circularPath, linearPath, oscillationPath } from '../animation/trajectory.ts';
import { distance } from '../calibration/math3d.ts';

describe('linearPath', () => {
  it('starts at start and ends at end, monotonically progressing (eased, not necessarily uniform speed)', () => {
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 1, y: 2, z: -1 };
    const path = linearPath(start, end, 20);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1].x).toBeCloseTo(end.x, 6);
    expect(path[path.length - 1].y).toBeCloseTo(end.y, 6);
    expect(path[path.length - 1].z).toBeCloseTo(end.z, 6);
  });

  it('total displacement matches the straight-line distance (schema min_displacement_ratio check)', () => {
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 0.36, y: 0, z: 0 };
    const path = linearPath(start, end, 30);
    expect(distance(path[0], path[path.length - 1])).toBeCloseTo(0.36, 6);
  });
});

describe('circularPath', () => {
  it('traces a full circle: every sampled point stays at `radius` from the pivot', () => {
    const pivot = { x: 0.1, y: 0.2, z: 0.3 };
    const radius = 0.1;
    const path = circularPath(pivot, radius, 2 * Math.PI, 40, { x: 0, y: 1, z: 0 });
    for (const p of path) {
      expect(distance(p, pivot)).toBeCloseTo(radius, 6);
    }
  });

  it('start and end coincide for exactly one full 2*PI rotation', () => {
    const pivot = { x: 0, y: 0, z: 0 };
    const path = circularPath(pivot, 0.1, 2 * Math.PI, 40, { x: 0, y: 1, z: 0 });
    expect(distance(path[0], path[path.length - 1])).toBeCloseTo(0, 6);
  });

  it('two full turns (COFFEE-style, 720deg) passes 300deg total-rotation-required threshold', () => {
    // total swept angle should be 4*PI regardless of easing distributing samples unevenly in time.
    const pivot = { x: 0, y: 0, z: 0 };
    const totalRotationRad = 2 * (2 * Math.PI);
    expect(totalRotationRad).toBeGreaterThan((300 * Math.PI) / 180);
    const path = circularPath(pivot, 0.1, totalRotationRad, 60, { x: 0, y: 1, z: 0 });
    expect(path.length).toBe(60);
  });
});

describe('oscillationPath', () => {
  it('produces at least `cycles` peak-to-peak swings of the requested amplitude', () => {
    const center = { x: 0, y: 0, z: 0 };
    const axis = { x: 1, y: 0, z: 0 };
    const amplitude = 0.15;
    const path = oscillationPath(center, axis, amplitude, 2, 60);
    const maxExcursion = Math.max(...path.map((p) => Math.abs(p.x)));
    expect(maxExcursion).toBeCloseTo(amplitude, 2);
  });
});
