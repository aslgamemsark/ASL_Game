import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync(new URL('../public/analytics-context.js', import.meta.url), 'utf8');
function open(url: string, values = new Map<string, string>()) {
  const window = { location: new URL(url), quickSignAnalyticsContext: undefined as any };
  runInNewContext(source, { window, navigator: {}, document: { referrer: '' }, URL, URLSearchParams,
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  return window.quickSignAnalyticsContext;
}

it('preserves first/latest campaigns across landing → app and only forwards safe fields', () => {
  const store = new Map<string, string>();
  const landing = open('https://quicksignn.vercel.app/landing.html?utm_source=instagram&utm_content=hello&access_token=secret&internal=1#refresh_token=secret', store);
  const props = landing.properties();
  const href = landing.appUrl('https://quicksignn.vercel.app/');
  expect(href).toContain('utm_content=hello');
  expect(href).not.toContain('secret');
  expect(open(href, store).properties()).toMatchObject({ first_utm_source: 'instagram', latest_utm_content: 'hello', traffic_type: 'internal' });
  const registered = Object.assign({}, props, open('https://quicksignn.vercel.app/?utm_source=reddit', store).properties());
  expect(registered).toMatchObject({ first_utm_source: props.first_utm_source, latest_utm_source: 'reddit', latest_utm_content: null });
  expect(open('https://quicksignn.vercel.app/', store).properties().latest_utm_source).toBe('reddit');
  expect(open('https://quicksignn.vercel.app/?internal=0', store).properties().traffic_type).toBe('external');
});

it('redacts credentials and invalid campaign values including nested initial properties', () => {
  const context = open('https://quicksignn.vercel.app/');
  const clean = context.sanitize({ $current_url: 'https://x.test/?code=secret#token', $set_once: { $initial_current_url: 'https://x.test/#token', $initial_utm_source: 'person@example.com' }, access_token: 'secret', utm_content: 'hello' });
  expect(clean.$current_url).toBe('https://x.test/');
  expect(clean.$set_once.$initial_current_url).toBe('https://x.test/');
  expect(clean.$set_once.$initial_utm_source).toBeNull();
  expect(clean.access_token).toBeUndefined();
  expect(context.sanitize({ token: 'phc_public' }).token).toBe('phc_public');
  expect(context.sanitize({ $elements: [{ attr__href: 'https://x.test/?code=secret#token' }] }).$elements[0].attr__href).toBe('https://x.test/');
});
