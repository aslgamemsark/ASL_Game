import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureAttribution, getFirstTouch, getSessionTouch, firstTouchProperties, sessionTouchProperties,
} from '@/analytics/attribution';

// Same no-jsdom constraint as consent.test.ts — this repo's Node-based vitest environment has none
// of window/document/localStorage/sessionStorage as globals by default, so all four are stubbed.
function makeStorage() {
  const backing = new Map<string, string>();
  return {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => { backing.set(k, v); },
    removeItem: (k: string) => { backing.delete(k); },
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  };
}

function setLocation(path: string, search: string): void {
  vi.stubGlobal('window', { location: { pathname: path, search } });
}

let localBacking: ReturnType<typeof makeStorage>;
let sessionBacking: ReturnType<typeof makeStorage>;

describe('attribution', () => {
  beforeEach(() => {
    localBacking = makeStorage();
    sessionBacking = makeStorage();
    vi.stubGlobal('localStorage', localBacking);
    vi.stubGlobal('sessionStorage', sessionBacking);
    vi.stubGlobal('document', { referrer: '' });
    setLocation('/', '');
  });

  it('is a no-op when the URL carries no UTM params', () => {
    setLocation('/', '?foo=bar');
    captureAttribution();
    expect(getFirstTouch()).toBeNull();
    expect(getSessionTouch()).toBeNull();
  });

  it('captures first-touch and session-touch from a UTM-bearing load', () => {
    setLocation('/', '?utm_source=reddit&utm_medium=social&utm_campaign=launch');
    captureAttribution();
    expect(getFirstTouch()).toEqual({
      utm_source: 'reddit', utm_medium: 'social', utm_campaign: 'launch',
      utm_content: null, utm_term: null, referrer: null, landing_path: '/',
    });
    expect(getSessionTouch()).toEqual(getFirstTouch());
  });

  it('first-touch is write-once; session-touch overwrites on every UTM-bearing load', () => {
    setLocation('/', '?utm_source=reddit');
    captureAttribution();

    setLocation('/asl-alphabet.html', '?utm_source=producthunt&utm_campaign=ph-launch');
    captureAttribution();

    expect(getFirstTouch()?.utm_source).toBe('reddit'); // unchanged
    expect(getSessionTouch()?.utm_source).toBe('producthunt'); // updated
    expect(getSessionTouch()?.landing_path).toBe('/asl-alphabet.html');
  });

  it('an organic (no-UTM) later visit does not clear existing attribution', () => {
    setLocation('/', '?utm_source=reddit');
    captureAttribution();
    setLocation('/app', '');
    captureAttribution();
    expect(getFirstTouch()?.utm_source).toBe('reddit');
    expect(getSessionTouch()?.utm_source).toBe('reddit');
  });

  it('fails silently (never throws) if storage is unreadable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
    });
    setLocation('/', '?utm_source=reddit');
    expect(() => captureAttribution()).not.toThrow();
    expect(getFirstTouch()).toBeNull();
  });

  it('firstTouchProperties/sessionTouchProperties are prefixed and empty when nothing is stored', () => {
    expect(firstTouchProperties()).toEqual({});
    expect(sessionTouchProperties()).toEqual({});

    setLocation('/', '?utm_source=hn&utm_content=comment');
    captureAttribution();
    expect(firstTouchProperties()).toEqual({
      first_touch_utm_source: 'hn', first_touch_utm_medium: null, first_touch_utm_campaign: null,
      first_touch_utm_content: 'comment', first_touch_utm_term: null,
      first_touch_referrer: null, first_touch_landing_path: '/',
    });
    expect(sessionTouchProperties()).toEqual({
      session_utm_source: 'hn', session_utm_medium: null, session_utm_campaign: null,
      session_utm_content: 'comment', session_utm_term: null,
    });
  });
});
