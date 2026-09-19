import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const state = vi.hoisted(() => ({
  ready: false, user: null as string | null, pending: [] as (() => void)[], calls: [] as string[],
  acceptCapture: true,
  events: [] as { name: string; user: string | null; properties: Record<string, unknown> }[],
}));
vi.mock('@/analytics/client', () => {
  const ph = {
    capture: (name: string, properties: Record<string, unknown>) => {
      if (!state.acceptCapture) return undefined;
      state.calls.push(name);
      const event = { name, user: state.user, properties };
      state.events.push(event);
      return event;
    },
    identify: (id: string) => { state.user = id; state.calls.push(`identify:${id}`); },
    reset: () => { state.user = null; state.calls.push('reset'); },
    group() {}, get_property: () => state.user,
    opt_in_capturing() {}, opt_out_capturing() {},
  };
  return {
    analyticsConfigured: true,
    getPosthog: () => state.ready ? ph : null,
    whenAnalyticsReady: (cb: () => void) => { if (state.ready) cb(); else state.pending.push(cb); },
    registerAnalyticsContext: () => state.calls.push('context'),
  };
});

beforeEach(() => {
  vi.resetModules();
  state.ready = false; state.user = null; state.pending = []; state.calls = [];
  state.acceptCapture = true; state.events = [];
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

const attempt = { signId: 'LETTER_A', source: 'onboarding' as const, msSinceLessonStart: 100, attemptsTaken: 1 };
const successKey = (identity: string) => `quicksign-first-sign-success-v3:${identity}`;
const account = (id: string) => ({ id, created_at: '2026-09-01T00:00:00Z', app_metadata: { provider: 'email' } }) as User;
function finishSdkLoad() {
  state.ready = true;
  state.pending.splice(0).forEach(callback => callback());
}

describe('analytics identity lifecycle', () => {
  it('preserves guest → identify → login → logout order while the SDK loads', async () => {
    const { track, identifyUser, resetIdentity } = await import('@/analytics/capture');
    const props = { username: null, provider: 'email' as const, account_age_days: 0, plan: 'beta' as const, language: null, country: null };
    track('guest_started', {});
    identifyUser('account-a', props);
    track('login', { provider: 'email' });
    resetIdentity();
    track('guest_started', {});
    expect(state.calls).toEqual([]);
    state.ready = true; state.pending.splice(0).forEach(cb => cb());
    expect(state.calls).toEqual(['guest_started', 'identify:account-a', 'login', 'reset', 'context', 'guest_started']);
    identifyUser('account-a', props);
    identifyUser('account-b', props);
    expect(state.calls.slice(-4)).toEqual(['identify:account-a', 'reset', 'context', 'identify:account-b']);
  });

  it('does not mark an opted-out first success; scopes later success to account/guest transitions', async () => {
    const { setFirstSuccessIdentity, trackFirstSignSuccess } = await import('@/analytics/firstSuccess');
    const attempt = { signId: 'LETTER_A', source: 'onboarding' as const, msSinceLessonStart: 100, attemptsTaken: 1 };
    localStorage.setItem('quicksign_analytics_opt_out', 'true');
    trackFirstSignSuccess(attempt);
    expect(state.pending).toHaveLength(0);
    localStorage.setItem('quicksign_analytics_opt_out', 'false');
    state.ready = true;
    trackFirstSignSuccess(attempt); trackFirstSignSuccess(attempt);
    setFirstSuccessIdentity('account-a'); trackFirstSignSuccess(attempt);
    expect(state.calls).toEqual(['first_sign_success']);
    setFirstSuccessIdentity('account-b'); trackFirstSignSuccess(attempt);
    setFirstSuccessIdentity(null); trackFirstSignSuccess(attempt);
    expect(state.calls).toHaveLength(3);
  });

  it('drops queued captures if consent changes before SDK readiness', async () => {
    const { track } = await import('@/analytics/capture');
    track('guest_started', {});
    localStorage.setItem('quicksign_analytics_opt_out', 'true');
    state.ready = true; state.pending.splice(0).forEach(cb => cb());
    expect(state.calls).toEqual([]);
  });

  it('reidentifies the current account when analytics is enabled again', async () => {
    const { identifyUser, setAnalyticsOptOut, track } = await import('@/analytics/capture');
    state.ready = true;
    setAnalyticsOptOut(true);
    identifyUser('account-b', { username: null, provider: 'email', account_age_days: 0, plan: 'beta', language: null, country: null });
    expect(state.calls).toEqual([]);
    setAnalyticsOptOut(false);
    track('login', { provider: 'email' });
    expect(state.calls).toEqual(['identify:account-b', 'login']);
  });

  it('deduplicates queued guest/account successes, then allows a new guest after logout', async () => {
    const { syncAnalyticsIdentity } = await import('@/analytics/AnalyticsIdentityBridge');
    const { trackFirstSignSuccess } = await import('@/analytics/firstSuccess');
    trackFirstSignSuccess(attempt);
    syncAnalyticsIdentity(account('account-a'));
    trackFirstSignSuccess(attempt);
    expect(state.events).toEqual([]);
    expect(localStorage.getItem(successKey('guest'))).toBeNull();

    finishSdkLoad();
    trackFirstSignSuccess(attempt);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ user: null, properties: { identity_scope: 'guest' } });
    expect(localStorage.getItem(successKey('account-a'))).toBe('1');
    expect(localStorage.getItem(successKey('guest'))).toBeNull();

    syncAnalyticsIdentity(null);
    trackFirstSignSuccess(attempt);
    expect(state.events).toHaveLength(2);
    expect(state.events[1]).toMatchObject({ user: null, properties: { identity_scope: 'guest' } });
    expect(state.calls).toEqual(['first_sign_success', 'identify:account-a', 'reset', 'context', 'first_sign_success']);
  });

  it('does not give account B the guest success assigned to A before SDK readiness', async () => {
    const { syncAnalyticsIdentity } = await import('@/analytics/AnalyticsIdentityBridge');
    const { trackFirstSignSuccess } = await import('@/analytics/firstSuccess');
    trackFirstSignSuccess(attempt);
    syncAnalyticsIdentity(account('account-a'));
    syncAnalyticsIdentity(null);
    syncAnalyticsIdentity(account('account-b'));
    trackFirstSignSuccess(attempt);
    finishSdkLoad();
    expect(state.events.map(event => [event.user, event.properties.identity_scope])).toEqual([
      [null, 'guest'], ['account-b', 'account'],
    ]);
    expect(localStorage.getItem(successKey('account-a'))).toBe('1');
    expect(localStorage.getItem(successKey('account-b'))).toBe('1');
    expect(localStorage.getItem(successKey('guest'))).toBeNull();
  });

  it('does not consume a queued success dropped by opt-out and allows a later opted-in success', async () => {
    const { syncAnalyticsIdentity } = await import('@/analytics/AnalyticsIdentityBridge');
    const { trackFirstSignSuccess } = await import('@/analytics/firstSuccess');
    const { setAnalyticsOptOut } = await import('@/analytics/capture');
    trackFirstSignSuccess(attempt);
    syncAnalyticsIdentity(account('account-a'));
    setAnalyticsOptOut(true);
    finishSdkLoad();
    expect(state.events).toEqual([]);
    expect(localStorage.getItem(successKey('guest'))).toBeNull();
    expect(localStorage.getItem(successKey('account-a'))).toBeNull();
    setAnalyticsOptOut(false);
    trackFirstSignSuccess(attempt);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ user: 'account-a', properties: { identity_scope: 'account' } });
  });

  it('consumes the migrated guest marker so another account after reload gets its own success', async () => {
    state.ready = true;
    const { syncAnalyticsIdentity } = await import('@/analytics/AnalyticsIdentityBridge');
    const { trackFirstSignSuccess } = await import('@/analytics/firstSuccess');
    trackFirstSignSuccess(attempt);
    syncAnalyticsIdentity(account('account-a'));
    expect(localStorage.getItem(successKey('guest'))).toBeNull();

    vi.resetModules(); // Reload loses module state, retaining browser and SDK persistence.
    const reloadedIdentity = await import('@/analytics/AnalyticsIdentityBridge');
    const reloadedSuccess = await import('@/analytics/firstSuccess');
    reloadedIdentity.syncAnalyticsIdentity(account('account-b'));
    reloadedSuccess.trackFirstSignSuccess(attempt);
    expect(state.events).toHaveLength(2);
    expect(state.events[1]).toMatchObject({ user: 'account-b', properties: { identity_scope: 'account' } });
  });

  it('persists a success only when the SDK accepts the capture', async () => {
    const { trackFirstSignSuccess } = await import('@/analytics/firstSuccess');
    state.ready = true;
    state.acceptCapture = false;
    trackFirstSignSuccess(attempt);
    expect(localStorage.getItem(successKey('guest'))).toBeNull();
    state.acceptCapture = true;
    trackFirstSignSuccess(attempt);
    trackFirstSignSuccess(attempt);
    expect(state.events).toHaveLength(1);
    expect(localStorage.getItem(successKey('guest'))).toBe('1');
  });
});
