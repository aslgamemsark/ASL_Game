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
