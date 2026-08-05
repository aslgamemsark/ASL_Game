import { describe, it, expect } from 'vitest';
import { buildAdminInsights, pickTopProblem, buildTrends, type BetaMetrics } from '../adminInsights';

function metrics(overrides: Partial<BetaMetrics> = {}): BetaMetrics {
  return {
    generated_at: '2026-07-20T00:00:00Z',
    users: { total: 100, dau: 20, wau: 60 },
    recognition: {
      attempts_total: 500, attempts_24h: 100, pass_rate: 0.7,
      rule_reject_rate: 0.1, rule_reject_denom: 500, ai_veto_rate: 0.05, ai_veto_denom: 500,
      avg_ai_confidence: 0.8, no_sign_count: 3,
    },
    top_failed_signs: [],
    feedback: { total: 0, open: 0, by_category: {} },
    ...overrides,
  };
}

const byKey = (ins: ReturnType<typeof buildAdminInsights>, key: string) => ins.find((i) => i.key === key)!;

describe('buildAdminInsights — success rate', () => {
  it('flags too-strict recognition as action', () => {
    const i = byKey(buildAdminInsights(metrics({ recognition: { ...metrics().recognition, pass_rate: 0.2 } })), 'success_rate');
    expect(i.status).toBe('action');
    expect(i.severity).toBeGreaterThan(50);
  });
  it('calls a healthy rate good', () => {
    expect(byKey(buildAdminInsights(metrics({ recognition: { ...metrics().recognition, pass_rate: 0.7 } })), 'success_rate').status).toBe('good');
  });
  it('flags a suspiciously high rate as watch', () => {
    expect(byKey(buildAdminInsights(metrics({ recognition: { ...metrics().recognition, pass_rate: 0.99 } })), 'success_rate').status).toBe('watch');
  });
  it('says "not enough data" (watch) under the minimum attempts', () => {
    expect(byKey(buildAdminInsights(metrics({ recognition: { ...metrics().recognition, attempts_total: 5, pass_rate: 0.1 } })), 'success_rate').status).toBe('watch');
  });
});

describe('buildAdminInsights — hardest sign & feedback', () => {
  it('flags a brutally hard sign as action', () => {
    const i = byKey(buildAdminInsights(metrics({ top_failed_signs: [{ sign_id: 'WATER', attempts: 40, failures: 32, fail_rate: 0.8 }] })), 'hardest_sign');
    expect(i.status).toBe('action');
    expect(i.plain).toContain('WATER');
  });
  it('says good when no sign is unusually hard', () => {
    expect(byKey(buildAdminInsights(metrics({ top_failed_signs: [{ sign_id: 'HELLO', attempts: 40, failures: 8, fail_rate: 0.2 }] })), 'hardest_sign').status).toBe('good');
  });
  it('flags unread feedback as action', () => {
    expect(byKey(buildAdminInsights(metrics({ feedback: { total: 5, open: 3, by_category: {} } })), 'feedback').status).toBe('action');
  });
});

describe('pickTopProblem', () => {
  it('picks the highest-severity action (too-strict beats hard sign beats feedback)', () => {
    const p = pickTopProblem(buildAdminInsights(metrics({
      recognition: { ...metrics().recognition, pass_rate: 0.2 },
      top_failed_signs: [{ sign_id: 'WATER', attempts: 40, failures: 32, fail_rate: 0.8 }],
      feedback: { total: 5, open: 3, by_category: {} },
    })));
    expect(p.hasProblem).toBe(true);
    expect(p.title).toBe('Success rate');
    expect(p.nextAction.length).toBeGreaterThan(0);
  });
  it('returns a calm no-problem state with a feedback nudge when all good', () => {
    const p = pickTopProblem(buildAdminInsights(metrics()));
    expect(p.hasProblem).toBe(false);
    expect(p.nextAction.toLowerCase()).toContain('feedback');
  });
});

describe('buildTrends', () => {
  it('reports direction when previous-period data is present', () => {
    const t = buildTrends(metrics({
      users: { total: 100, dau: 42, wau: 60, dau_prev: 30 },
      recognition: { ...metrics().recognition, attempts_24h: 100, attempts_prev_24h: 80, pass_rate_24h: 0.75, pass_rate_prev_24h: 0.6 },
    }));
    expect(t.find((x) => x.key === 'users')!.dir).toBe('up');
    expect(t.find((x) => x.key === 'accuracy')!.dir).toBe('up');
  });
  it('omits trends when previous-period data is absent (graceful degrade)', () => {
    expect(buildTrends(metrics())).toHaveLength(0);
  });
  it('treats a tiny rate change as flat', () => {
    const t = buildTrends(metrics({
      users: { total: 100, dau: 20, wau: 60, dau_prev: 20 },
      recognition: { ...metrics().recognition, attempts_24h: 100, attempts_prev_24h: 100, pass_rate_24h: 0.70, pass_rate_prev_24h: 0.71 },
    }));
    expect(t.find((x) => x.key === 'accuracy')!.dir).toBe('flat');
  });
});
