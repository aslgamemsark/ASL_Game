/**
 * Shapes and pure transforms for the `admin_analytics()` RPC that powers the AdminPanel
 * "Analytics" tab. Kept UI-free and pure so the derived series (rolling WAU) and formatting live
 * in one place and are unit-testable (project rules: design for testability; no scattered logic).
 *
 * Honest scope, matching what the RPC can actually see in Postgres: "active" = filed at least one
 * sign attempt. Logins, screen views, funnels and traffic source are PostHog-only (see
 * docs/POSTHOG_GUIDE.md) and are NOT represented here. Guests have no server row, so every number
 * counts registered users only. Region coverage is partial (a large 'Unknown' bucket is normal).
 */

// ---- Metric shapes (returned by the admin_analytics RPC) --------------------------------------

export interface GrowthPoint {
  /** UTC calendar day, ISO `YYYY-MM-DD`. */
  day: string;
  signups: number;
  /** Running total of all registered users through this day (not window-relative). */
  cumulative: number;
}

export interface ActivePoint {
  /** UTC calendar day, ISO `YYYY-MM-DD`. */
  day: string;
  /** Distinct users who filed a sign attempt on this day. */
  dau: number;
}

export interface RetentionWeek {
  /** Whole weeks after the cohort's signup week. 0 = signup week itself. */
  offset: number;
  active: number;
  /** active / cohort_size, 0..1. */
  pct: number;
}

export interface RetentionCohort {
  /** UTC start-of-week the cohort signed up in, ISO `YYYY-MM-DD`. */
  cohort_week: string;
  cohort_size: number;
  weeks: RetentionWeek[];
}

export interface CountryCount {
  /** ISO alpha-2 code, or the literal `'Unknown'` for users with no region. */
  region: string;
  users: number;
}

export interface HistogramBucket {
  bucket: string;
  count: number;
}

export interface EngagementMetrics {
  total_with_progress: number;
  median_level: number;
  median_streak: number;
  median_xp: number;
  level_hist: HistogramBucket[];
  streak_hist: HistogramBucket[];
  lessons_hist: HistogramBucket[];
}

export interface AdminAnalytics {
  generated_at: string;
  window_days: number;
  growth: GrowthPoint[];
  active: ActivePoint[];
  retention: RetentionCohort[];
  geography: CountryCount[];
  engagement: EngagementMetrics;
}

// ---- Derived series ---------------------------------------------------------------------------

/** Rolling weekly-active count per day: distinct-attempter DAU can't simply be summed (a user
 *  active on two days would double-count), but for a display trendline we approximate WAU as the
 *  sum of DAU over the trailing 7 days. This intentionally over-counts repeat-day users — it's a
 *  shape indicator, labelled as such in the UI, not an exact unique-user WAU. */
export interface ActiveWithRolling extends ActivePoint {
  wau7: number;
}

export function withRollingWau(active: ActivePoint[]): ActiveWithRolling[] {
  const WINDOW = 7;
  return active.map((point, i) => {
    let sum = 0;
    for (let j = Math.max(0, i - (WINDOW - 1)); j <= i; j++) sum += active[j].dau;
    return { ...point, wau7: sum };
  });
}

/** The widest offset present across all cohorts — the number of week columns the retention grid
 *  needs. Returns -1 when there are no cohorts (caller renders an empty state). */
export function maxRetentionOffset(cohorts: RetentionCohort[]): number {
  let max = -1;
  for (const c of cohorts) {
    for (const w of c.weeks) if (w.offset > max) max = w.offset;
  }
  return max;
}

/** Retention pct for a specific (cohort, week-offset) cell, or null if that cohort has no row for
 *  that offset (i.e. the cohort isn't old enough to have reached that week yet — a blank cell). */
export function retentionCell(cohort: RetentionCohort, offset: number): number | null {
  const week = cohort.weeks.find((w) => w.offset === offset);
  return week ? week.pct : null;
}

// Re-exported so existing importers (CohortGrid, TrendChart) don't need to change their import
// path — the formatter itself now lives in lib/formatTimestamp.ts, the one place shared with
// AdminPanel.tsx's feedback/audit-log timestamps, so the month-name formatting logic exists once.
export { formatDayLabel } from './formatTimestamp';
