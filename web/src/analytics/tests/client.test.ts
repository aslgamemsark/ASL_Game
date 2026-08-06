import { describe, it, expect } from 'vitest';
import { sanitizeAnalyticsProperties } from '@/analytics/client';

describe('sanitizeAnalyticsProperties', () => {
  it('strips a query string off $current_url', () => {
    const out = sanitizeAnalyticsProperties({ $current_url: 'https://app.example/reset?token=secret123' });
    expect(out.$current_url).toBe('https://app.example/reset');
  });

  it('strips a query string off $referrer and $referring_domain', () => {
    const out = sanitizeAnalyticsProperties({
      $referrer: 'https://ref.example/page?utm_source=x',
      $referring_domain: 'ref.example?weird=1',
    });
    expect(out.$referrer).toBe('https://ref.example/page');
    expect(out.$referring_domain).toBe('ref.example');
  });

  it('leaves a URL with no query string untouched', () => {
    const out = sanitizeAnalyticsProperties({ $current_url: 'https://app.example/home' });
    expect(out.$current_url).toBe('https://app.example/home');
  });

  it('leaves unrelated properties untouched', () => {
    const out = sanitizeAnalyticsProperties({ sign_id: 'HELLO', $current_url: 'https://app.example/x?y=1' });
    expect(out.sign_id).toBe('HELLO');
  });
});

/**
 * Security regression, 2026-07-27. This function split on '?' only, so it did nothing to a
 * FRAGMENT — and Supabase returns auth credentials in the fragment. A real PostHog session
 * recording's start_url was found carrying a live `access_token` and `refresh_token` from a
 * `type=signup` redirect, with the user's email readable in the JWT payload.
 *
 * The shape below is the real leaked URL with the credentials replaced.
 */
describe('sanitizeAnalyticsProperties — auth credentials in the URL fragment', () => {
  const LEAKED = 'https://aslgame.vercel.app/#access_token=eyJhbGciOiJFUzI1NiJ9.PAYLOAD.SIG'
    + '&expires_at=1785020158&refresh_token=vuf3uclmsvow&token_type=bearer&type=signup';

  it('redacts the entire fragment, not just a query string', () => {
    const out = sanitizeAnalyticsProperties({ $current_url: LEAKED });
    expect(out.$current_url).toBe('https://aslgame.vercel.app/');
  });

  it('leaves no trace of any credential token in the output', () => {
    const out = sanitizeAnalyticsProperties({ $current_url: LEAKED, $referrer: LEAKED });
    for (const value of [out.$current_url, out.$referrer]) {
      expect(String(value)).not.toMatch(/access_token|refresh_token|eyJ/);
    }
  });

  it('cuts at whichever separator comes first, so neither tail survives the other', () => {
    // A fragment containing '?' — splitting on '?' first would keep the credential-bearing head.
    expect(
      sanitizeAnalyticsProperties({ $current_url: 'https://a.example/p#access_token=x?y=1' }).$current_url
    ).toBe('https://a.example/p');
    // A query string containing '#' — splitting on '#' first would keep the query.
    expect(
      sanitizeAnalyticsProperties({ $current_url: 'https://a.example/p?token=x#frag' }).$current_url
    ).toBe('https://a.example/p');
  });

  it('handles a non-string value without throwing', () => {
    expect(() => sanitizeAnalyticsProperties({ $current_url: undefined })).not.toThrow();
  });
});
