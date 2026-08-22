/**
 * Adaptive pacing for the vision (MediaPipe) stage of the recognition loop.
 *
 * WHY (shipping-readiness v2): the loop ran MediaPipe at a FIXED 28 fps regardless of device.
 * On low-end phones a single hand+pose `detectForVideo` pass can cost 40–70 ms; demanding 28 fps
 * from such a device guarantees saturated main-thread budget — exactly the reported "camera gets
 * laggy during gameplay". The verifier itself is TIME-windowed (RollingBuffer by seconds,
 * wall-clock hold timers, movement thresholds in ratios), so fewer-but-fresh samples preserve
 * recognition semantics while freeing budget for preview rendering and React.
 *
 * Policy (deliberately conservative):
 *  • BASE tier: 28 fps (unchanged default — every capable device behaves exactly as before).
 *  • LOW tier: 20 fps, entered ONLY when the MEDIAN of recent per-frame inference costs sustains
 *    above `downgradeCostMs` past a warmup frame count.
 *  • MEDIAN, not mean/EMA: a single garbage-collection pause or GPU hiccup (hundreds of ms in one
 *    sample) must not flip tiers — the median ignores isolated spikes entirely while still
 *    reflecting genuinely sustained slowness within `windowSize` frames.
 *  • One-way per loop session (no re-upgrade until the next startLoop()): prevents flapping
 *    between tiers as scene difficulty changes (hands entering/leaving change pose cost).
 *
 * This is measured self-pacing (actual inference cost), not UA sniffing or resolution reduction.
 * Recognition accuracy is untouched: same models, same math, same thresholds — only the sample
 * rate of fresh frames adapts, and the rolling window already tolerates variable frame timing.
 */
export type VisionTier = 'base' | 'low';

export interface VisionPacerOptions {
  /** Normal-tier vision rate cap. Default 28 (matches the historical fixed value). */
  baseFps?: number;
  /** Low-tier vision rate cap. Default 20 — NOT 10: still comfortably above the movement
   *  scorer's sampling needs while cutting per-second inference cost by ~29%. */
  lowFps?: number;
  /** Median per-frame cost above which the device is judged unable to sustain the base tier.
   *  Default 42 ms (~24 fps worth of pure inference — leaves <12 ms for everything else). */
  downgradeCostMs?: number;
  /** Frames processed before a downgrade decision is allowed — skips first-touch JIT/GPU-warmup
   *  spikes that would otherwise instantly trip every cold session into LOW. Default 20. */
  warmupFrames?: number;
  /** How many recent cost samples the median considers. Default 30 (~1s at base rate). */
  windowSize?: number;
}

export class VisionPacer {
  private readonly baseIntervalMs: number;
  private readonly lowIntervalMs: number;
  private readonly downgradeCostMs: number;
  private readonly warmupFrames: number;
  private readonly windowSize: number;

  private costs: number[] = [];
  private framesSeen = 0;
  private lastProcessMs = -Infinity;
  private _tier: VisionTier = 'base';

  constructor(options: VisionPacerOptions = {}) {
    const {
      baseFps = 28,
      lowFps = 20,
      downgradeCostMs = 42,
      warmupFrames = 20,
      windowSize = 30,
    } = options;
    this.baseIntervalMs = 1000 / baseFps;
    this.lowIntervalMs = 1000 / lowFps;
    this.downgradeCostMs = downgradeCostMs;
    this.warmupFrames = warmupFrames;
    this.windowSize = Math.max(1, windowSize);
  }

  get tier(): VisionTier {
    return this._tier;
  }

  /** Current minimum spacing between processed frames, per the active tier. */
  get minIntervalMs(): number {
    return this._tier === 'base' ? this.baseIntervalMs : this.lowIntervalMs;
  }

  /** Median of recent inference-cost samples (the statistic the tier decision uses). */
  get medianCost(): number {
    return median(this.costs);
  }

  get framesProcessed(): number {
    return this.framesSeen;
  }

  /**
   * Latest-frame strategy: true only when enough time has passed since the last PROCESSED
   * frame. Callers drive this from rAF; skipped (stale) display frames simply never queue —
   * there is no backlog by construction.
   */
  shouldProcess(nowMs: number): boolean {
    return nowMs - this.lastProcessMs >= this.minIntervalMs;
  }

  /** Record that a frame was processed at nowMs. */
  markProcessed(nowMs: number): void {
    this.lastProcessMs = nowMs;
    this.framesSeen += 1;
  }

  /**
   * Feed one wall-clock `process()` cost sample. May switch to the LOW tier once warmup frames
   * have been seen; the switch is one-way for the lifetime of this pacer instance (one
   * startLoop() session) to avoid tier flapping.
   */
  recordCost(costMs: number): VisionTier {
    this.costs.push(costMs);
    if (this.costs.length > this.windowSize) this.costs.shift();

    if (
      this._tier === 'base' &&
      this.framesSeen >= this.warmupFrames &&
      this.costs.length >= Math.min(this.warmupFrames, this.windowSize) &&
      this.medianCost > this.downgradeCostMs
    ) {
      this._tier = 'low';
    }
    return this._tier;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
