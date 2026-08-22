import { describe, it, expect } from 'vitest';
import { VisionPacer } from '../visionPacer';

describe('VisionPacer', () => {
  it('defaults to the historical 28fps base cap', () => {
    const p = new VisionPacer();
    expect(p.tier).toBe('base');
    expect(p.minIntervalMs).toBeCloseTo(1000 / 28, 4);
  });

  it('shouldProcess enforces latest-frame spacing (no backlog by construction)', () => {
    const p = new VisionPacer();
    expect(p.shouldProcess(0)).toBe(true); // -Infinity lastProcess
    p.markProcessed(0);
    expect(p.shouldProcess(10)).toBe(false);
    expect(p.shouldProcess(36)).toBe(true); // 1000/28 ≈ 35.7
    p.markProcessed(36);
    expect(p.shouldProcess(50)).toBe(false);
  });

  it('stays in base tier while cost samples are cheap', () => {
    const p = new VisionPacer();
    for (let i = 0; i < 60; i++) {
      p.markProcessed(i * 36);
      expect(p.recordCost(15)).toBe('base');
    }
    expect(p.medianCost).toBe(15);
  });

  it('does not downgrade during warmup even if early frames spike (GPU/JIT warmup)', () => {
    const p = new VisionPacer({ warmupFrames: 20 });
    for (let i = 0; i < 19; i++) {
      p.markProcessed(i * 40);
      p.recordCost(120); // cold-start spike territory
    }
    expect(p.tier).toBe('base'); // 19 < warmupFrames, and sample count below warmup too
    p.markProcessed(20 * 40);
    p.recordCost(120);
    expect(p.tier).toBe('low');
  });

  it('downgrades to low tier after sustained expensive frames past warmup', () => {
    const p = new VisionPacer({ warmupFrames: 5 });
    for (let i = 0; i < 30; i++) {
      p.markProcessed(i * 50);
      p.recordCost(60);
    }
    expect(p.tier).toBe('low');
    expect(p.minIntervalMs).toBeCloseTo(1000 / 20, 4);
    expect(p.framesProcessed).toBe(30);
  });

  it('never upgrades back within a session (one-way tier switch, no flapping)', () => {
    const p = new VisionPacer({ warmupFrames: 5 });
    for (let i = 0; i < 30; i++) {
      p.markProcessed(i * 50);
      p.recordCost(60);
    }
    expect(p.tier).toBe('low');
    for (let i = 30; i < 80; i++) {
      p.markProcessed(i * 50);
      p.recordCost(8); // device got easy again mid-session
    }
    expect(p.tier).toBe('low');
    expect(p.minIntervalMs).toBeCloseTo(1000 / 20, 4);
  });

  it('ignores single-frame spikes (GC/GPU hiccup) via median — no false downgrade', () => {
    const p = new VisionPacer({ warmupFrames: 2 });
    for (let i = 0; i < 10; i++) {
      p.markProcessed(i * 36);
      p.recordCost(15);
    }
    // One garbage-collection pause of 500ms must not flip tiers.
    p.recordCost(500);
    expect(p.tier).toBe('base');
    // Nor a second one in a different frame window.
    for (let i = 11; i < 15; i++) {
      p.markProcessed(i * 36);
      p.recordCost(15);
    }
    p.recordCost(400);
    expect(p.tier).toBe('base');
  });

  it('accepts custom fps overrides', () => {
    const p = new VisionPacer({ baseFps: 30, lowFps: 15 });
    expect(p.minIntervalMs).toBeCloseTo(1000 / 30, 4);
    for (let i = 0; i < 40; i++) {
      p.markProcessed(i * 34);
      p.recordCost(90);
    }
    expect(p.tier).toBe('low');
    expect(p.minIntervalMs).toBeCloseTo(1000 / 15, 4);
  });
});
