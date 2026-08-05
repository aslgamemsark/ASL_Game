import { describe, it, expect } from 'vitest';
import { detectInAppBrowser } from '../inAppBrowser';

const NAV_OK = { mediaDevices: { getUserMedia: () => {} } };

describe('detectInAppBrowser', () => {
  it('flags known in-app browsers by user agent', () => {
    const reddit = 'Mozilla/5.0 (iPhone) AppleWebKit/605 Reddit/2024.1';
    const r = detectInAppBrowser(reddit, NAV_OK);
    expect(r.isInApp).toBe(true);
    expect(r.appName).toBe('Reddit');
  });

  it('flags Instagram / Facebook / TikTok webviews', () => {
    expect(detectInAppBrowser('... Instagram 300.0', NAV_OK).appName).toBe('Instagram');
    expect(detectInAppBrowser('... [FBAN/FBIOS;FBAV/400]', NAV_OK).appName).toBe('Facebook');
    expect(detectInAppBrowser('... musical_ly TikTok', NAV_OK).appName).toBe('TikTok');
  });

  it('does NOT flag a normal mobile Safari/Chrome UA', () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
    const r = detectInAppBrowser(safari, NAV_OK);
    expect(r.isInApp).toBe(false);
    expect(r.appName).toBeNull();
  });

  it('flags any context lacking getUserMedia, regardless of UA (camera cannot work there)', () => {
    const r = detectInAppBrowser('any-ua', { mediaDevices: undefined });
    expect(r.isInApp).toBe(true);
    expect(r.cameraUnavailable).toBe(true);
  });
});
