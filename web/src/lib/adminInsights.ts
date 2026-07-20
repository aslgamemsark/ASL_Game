/**
 * Turns the raw `admin_beta_metrics()` numbers into plain-English, action-oriented insights a
 * non-technical admin can act on without knowing statistics or PostHog. Kept UI-free and pure so the
 * interpretation thresholds live in one place and are unit-testable (project rules: design for
 * testability; no scattered magic numbers).
 *
 * Three outputs, in priority order for the admin's eye:
 *   pickTopProblem()    -> the single highest-priority issue right now (what/why/check/next action)
 *   buildTrends()       -> "since yesterday" direction arrows for the key metrics
 *   buildAdminInsights() -> the full plain-English status list (good / watch / action)
 *
 * Camera and multiplayer failure signals are NOT here — they live in PostHog (see
 * docs/POSTHOG_GUIDE.md), because they aren't stored in Supabase. This module covers what
 * admin_beta_metrics can see: users, recognition, hardest signs, feedback.
 */

// ---- Metric shapes (returned by the admin_beta_metrics RPC) -----------------------------------
// The `*_prev*` / `*_24h` fields are OPTIONAL so this module works whether or not the RPC has been
// extended with previous-period data yet (trends degrade to "unknown" gracefully).

export interface RecognitionMetrics {
  attempts_total: number;
  attempts_24h: number;
  pass_rate: number | null;
  rule_reject_rate: number | null;
  rule_reject_denom: number;
  ai_veto_rate: number | null;
  ai_veto_denom: number;
  avg_ai_confidence: number | null;
  no_sign_count: number;
  attempts_prev_24h?: number;
  pass_rate_24h?: number | null;
  pass_rate_prev_24h?: number | null;
}

export interface BetaMetrics {
  generated_at: string;
  users: { total: number; dau: number; wau: number; dau_prev?: number };
  recognition: RecognitionMetrics;
  top_failed_signs: { sign_id: string; attempts: number; failures: number; fail_rate: number }[];
  feedback: { total: number; open: number; by_category: Record<string, number> };
}

// ---- Tuning knobs (thresholds for turning a number into a verdict) -----------------------------
// Declared, reasoned values — adjust deliberately, not to make one reading look better.
const SUCCESS_RATE_TOO_STRICT = 0.35; // below this: users are struggling to get signs accepted
const SUCCESS_RATE_TOO_LENIENT = 0.95; // above this: signs may be passing too easily
const HARD_SIGN_FAIL_RATE = 0.6; // a sign failing at/above this rate is worth making easier
const MIN_ATTEMPTS_TO_JUDGE = 20; // below this total, success-rate readings are too noisy to trust
const MIN_ATTEMPTS_FOR_TREND = 10; // per-window minimum before a "since yesterday" arrow is meaningful
const TREND_EPSILON = 0.03; // <3 percentage-point change on a rate reads as "about the same"

// ---- Status + insight types --------------------------------------------------------------------

export type AdminStatus = 'good' | 'watch' | 'action';

export interface AdminInsight {
  key: string;
  title: string;
  /** One plain-English sentence stating the current situation. */
  plain: string;
  status: AdminStatus;
  /** Higher = more urgent; used to pick the single biggest problem. */
  severity: number;
  /** Only on action/watch items — the recommended fix, in plain words. */
  advice?: string;
  why?: string;
  checkFirst?: string;
  nextAction?: string;
}

function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`;
}

/** The full plain-English status list, most-urgent first. */
export function buildAdminInsights(m: BetaMetrics): AdminInsight[] {
  const insights: AdminInsight[] = [];

  // 1. People (informational unless nobody showed up).
  insights.push(
    m.users.dau === 0 && m.users.total > 0
      ? {
          key: 'people',
          title: 'Activity',
          plain: `No one practiced today (${m.users.total} total users, ${m.users.wau} active this week).`,
          status: 'watch',
          severity: 20,
          advice: 'Expected if you haven’t posted yet — this should jump on launch day.',
        }
      : {
          key: 'people',
          title: 'Activity',
          plain: `${m.users.dau} practiced today, ${m.users.wau} this week, ${m.users.total} total.`,
          status: 'good',
          severity: 0,
        },
  );

  // 2. Success rate (how often a tried sign is accepted).
  const rate = m.recognition.pass_rate;
  if (m.recognition.attempts_total < MIN_ATTEMPTS_TO_JUDGE || rate === null) {
    insights.push({
      key: 'success_rate',
      title: 'Success rate',
      plain: 'Not enough sign attempts yet to judge how well recognition is working.',
      status: 'watch',
      severity: 10,
    });
  } else if (rate < SUCCESS_RATE_TOO_STRICT) {
    insights.push({
      key: 'success_rate',
      title: 'Success rate',
      plain: `People are struggling — a sign is accepted only ${fmtPct(rate)} of the time it’s tried.`,
      status: 'action',
      severity: 100,
      advice: 'Recognition may be too strict, or users can’t frame themselves properly.',
      why: 'If people can’t get signs accepted, they give up and never finish a lesson — the opposite of what makes them come back.',
      checkFirst: 'Look at "Hardest signs" below — is it one bad sign dragging the average down, or all of them?',
      nextAction: 'If it’s one sign, recalibrate it (see the /new-sign workflow). If it’s across the board, the camera-framing guide or thresholds need attention.',
    });
  } else if (rate > SUCCESS_RATE_TOO_LENIENT) {
    insights.push({
      key: 'success_rate',
      title: 'Success rate',
      plain: `Signs are accepted ${fmtPct(rate)} of the time — that may be too easy.`,
      status: 'watch',
      severity: 30,
      advice: 'Recognition might be passing signs that aren’t quite right. Worth spot-checking.',
    });
  } else {
    insights.push({
      key: 'success_rate',
      title: 'Success rate',
      plain: `Healthy — a sign is accepted ${fmtPct(rate)} of the time it’s tried.`,
      status: 'good',
      severity: 0,
    });
  }

  // 3. Hardest sign (worst offender above the fail threshold).
  const worst = m.top_failed_signs.find((s) => s.fail_rate >= HARD_SIGN_FAIL_RATE);
  if (worst) {
    insights.push({
      key: 'hardest_sign',
      title: 'Hardest sign',
      plain: `"${worst.sign_id}" fails ${fmtPct(worst.fail_rate)} of the time (${worst.failures} of ${worst.attempts} tries).`,
      status: 'action',
      severity: 80,
      advice: `Consider making "${worst.sign_id}" easier to pass.`,
      why: 'One brutally hard sign is a wall people hit and quit at — it can sink a whole lesson’s completion rate.',
      checkFirst: `Try "${worst.sign_id}" yourself on camera — is the sign genuinely hard to detect, or is the definition wrong?`,
      nextAction: 'Recalibrate its thresholds from real recordings (the /new-sign workflow), then watch this number drop.',
    });
  } else {
    insights.push({
      key: 'hardest_sign',
      title: 'Hardest sign',
      plain: 'No sign is failing unusually often.',
      status: 'good',
      severity: 0,
    });
  }

  // 4. Unread feedback.
  if (m.feedback.open > 0) {
    insights.push({
      key: 'feedback',
      title: 'Feedback',
      plain: `You have ${m.feedback.open} unread message${m.feedback.open === 1 ? '' : 's'} from users.`,
      status: 'action',
      severity: 40,
      advice: 'Read them below — early beta feedback is your best bug list.',
      why: 'Beta testers tell you exactly what’s broken and what to build — ignoring it wastes your most valuable signal.',
      checkFirst: 'Scroll to the Feedback inbox below.',
      nextAction: 'Read each one, mark it triaged/resolved, and fix the most-repeated complaint first.',
    });
  } else {
    insights.push({
      key: 'feedback',
      title: 'Feedback',
      plain: 'No unread feedback.',
      status: 'good',
      severity: 0,
    });
  }

  return insights.sort((a, b) => b.severity - a.severity);
}

// ---- Today's biggest problem -------------------------------------------------------------------

export interface TopProblem {
  hasProblem: boolean;
  title: string;
  whatsWrong: string;
  whyItMatters: string;
  checkFirst: string;
  nextAction: string;
}

/** The single highest-priority issue right now, expanded into what/why/check/next. If nothing needs
 *  action, returns a calm "no critical issues" with a nudge toward gathering feedback. */
export function pickTopProblem(insights: AdminInsight[]): TopProblem {
  const top = insights.find((i) => i.status === 'action');
  if (!top) {
    return {
      hasProblem: false,
      title: 'No critical issues detected today',
      whatsWrong: 'Nothing needs urgent attention right now.',
      whyItMatters: 'A quiet dashboard is a good thing — the app is behaving.',
      checkFirst: 'Skim the Since-yesterday trends and the plain-English cards below.',
      nextAction: 'Focus on gathering more user feedback — invite testers, and read anything that comes in.',
    };
  }
  return {
    hasProblem: true,
    title: top.title,
    whatsWrong: top.plain,
    whyItMatters: top.why ?? 'This is the most urgent thing affecting your users right now.',
    checkFirst: top.checkFirst ?? 'Open the matching section below for detail.',
    nextAction: top.nextAction ?? top.advice ?? 'Investigate and address this before anything else.',
  };
}

// ---- Since-yesterday trends --------------------------------------------------------------------

export type TrendDir = 'up' | 'down' | 'flat' | 'unknown';

export interface Trend {
  key: string;
  label: string;
  dir: TrendDir;
  /** Plain-English one-liner, e.g. "Users: 30 -> 42 (up)". */
  plain: string;
  /** True when "up" is the good direction (users, accuracy); false where down is better. */
  goodWhenUp: boolean;
}

function countDir(current: number, previous: number): TrendDir {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function rateDir(current: number, previous: number): TrendDir {
  const delta = current - previous;
  if (Math.abs(delta) < TREND_EPSILON) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/** "Since yesterday" direction for the metrics we can compare period-over-period. Any metric whose
 *  previous-period value the RPC didn't provide comes back as 'unknown' and the UI can hide it. */
export function buildTrends(m: BetaMetrics): Trend[] {
  const trends: Trend[] = [];

  // Active users: today vs yesterday.
  if (m.users.dau_prev !== undefined) {
    trends.push({
      key: 'users',
      label: 'People practicing',
      dir: countDir(m.users.dau, m.users.dau_prev),
      plain: `${m.users.dau_prev} yesterday → ${m.users.dau} today`,
      goodWhenUp: true,
    });
  }

  // Attempts volume: last 24h vs the 24h before.
  if (m.recognition.attempts_prev_24h !== undefined) {
    trends.push({
      key: 'attempts',
      label: 'Signs attempted',
      dir: countDir(m.recognition.attempts_24h, m.recognition.attempts_prev_24h),
      plain: `${m.recognition.attempts_prev_24h} → ${m.recognition.attempts_24h} in the last day`,
      goodWhenUp: true,
    });
  }

  // Recognition accuracy: last 24h vs the 24h before (only if both windows have enough tries).
  const cur = m.recognition.pass_rate_24h;
  const prev = m.recognition.pass_rate_prev_24h;
  if (
    cur !== undefined && cur !== null && prev !== undefined && prev !== null &&
    m.recognition.attempts_24h >= MIN_ATTEMPTS_FOR_TREND &&
    (m.recognition.attempts_prev_24h ?? 0) >= MIN_ATTEMPTS_FOR_TREND
  ) {
    trends.push({
      key: 'accuracy',
      label: 'Recognition accuracy',
      dir: rateDir(cur, prev),
      plain: `${fmtPct(prev)} → ${fmtPct(cur)} accepted`,
      goodWhenUp: true,
    });
  }

  return trends;
}
