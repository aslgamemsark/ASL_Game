import { describe, it, expect } from 'vitest';
import {
  withRollingWau,
  maxRetentionOffset,
  retentionCell,
  type ActivePoint,
  type RetentionCohort,
} from '../adminAnalytics';

const day = (n: number): string => `2026-07-${String(n).padStart(2, '0')}`;

describe('withRollingWau', () => {
  it('sums DAU over the trailing 7 days, clamping at the start of the series', () => {
    const active: ActivePoint[] = [1, 2, 3, 4, 5, 6, 7, 8].map((d, i) => ({
      day: day(d),
      dau: i + 1, // 1,2,3,4,5,6,7,8
    }));
    const out = withRollingWau(active);
    // Day 0: only itself -> 1
    expect(out[0].wau7).toBe(1);
    // Day 3 (index 3): 1+2+3+4 = 10 (fewer than 7 days available, no clamp loss)
    expect(out[3].wau7).toBe(10);
    // Day 6 (index 6): 1..7 = 28 (exactly 7 days)
    expect(out[6].wau7).toBe(28);
    // Day 7 (index 7): 2..8 = 35 (window slid, first day dropped)
    expect(out[7].wau7).toBe(35);
  });

  it('returns an empty array for empty input', () => {
    expect(withRollingWau([])).toEqual([]);
  });

  it('preserves the original day/dau fields', () => {
    const out = withRollingWau([{ day: day(1), dau: 4 }]);
    expect(out[0]).toEqual({ day: day(1), dau: 4, wau7: 4 });
  });
});

describe('maxRetentionOffset', () => {
  it('returns -1 when there are no cohorts', () => {
    expect(maxRetentionOffset([])).toBe(-1);
  });

  it('finds the widest offset across all cohorts', () => {
    const cohorts: RetentionCohort[] = [
      { cohort_week: day(1), cohort_size: 3, weeks: [{ offset: 0, active: 3, pct: 1 }, { offset: 2, active: 1, pct: 0.33 }] },
      { cohort_week: day(8), cohort_size: 2, weeks: [{ offset: 0, active: 2, pct: 1 }, { offset: 5, active: 1, pct: 0.5 }] },
    ];
    expect(maxRetentionOffset(cohorts)).toBe(5);
  });
});

describe('retentionCell', () => {
  const cohort: RetentionCohort = {
    cohort_week: day(1),
    cohort_size: 4,
    weeks: [
      { offset: 0, active: 4, pct: 1 },
      { offset: 2, active: 1, pct: 0.25 },
    ],
  };

  it('returns the pct when the offset exists', () => {
    expect(retentionCell(cohort, 0)).toBe(1);
    expect(retentionCell(cohort, 2)).toBe(0.25);
  });

  it('returns null for a missing offset (cohort not old enough / no activity that week)', () => {
    expect(retentionCell(cohort, 1)).toBeNull();
    expect(retentionCell(cohort, 9)).toBeNull();
  });
});
