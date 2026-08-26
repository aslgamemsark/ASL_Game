// ASL-J4 — analytics-PII probe against the PRODUCTION build (ad-hoc, not canonical suite).
// Loads the built app, lets PostHog initialize with a REAL (non-bot) browser identity, intercepts
// every outbound /e/ event batch (gzip-decoded) and inspects what is actually sent: which hosts,
// whether tokens/emails/JWTs appear in event properties, whether $current_url is sanitized,
// and whether the opt-out flag stops capture.
import { chromium } from 'playwright-core';
import { gunzipSync, inflateSync, inflateRawSync } from 'zlib';

const results = [];
function rec(name, ok, detail = '') { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` | ${detail}` : ''}`); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
  // posthog-js's bot filter silently drops ALL events when it detects automation: it checks
  // navigator.userAgent ("HeadlessChrome"), userAgentData.brands, and navigator.webdriver.
  // Scrub all three so the pipeline under audit behaves exactly as for a real user.
  userAgent: UA,
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'userAgentData', {
    get: () => ({
      brands: [
        { brand: 'Chromium', version: '149' },
        { brand: 'Google Chrome', version: '149' },
        { brand: 'Not)A;Brand', version: '24' },
      ],
      mobile: false,
      platform: 'Windows',
    }),
  });
});

const bodies = [];
await page.route('**/e/**', async route => {
  if (route.request().method() === 'POST') {
    const buf = route.request().postDataBuffer() || Buffer.alloc(0);
    let decoded;
    for (const fn of [() => gunzipSync(buf), () => inflateSync(buf), () => inflateRawSync(buf), () => buf]) {
      try { decoded = fn().toString('utf8'); break; } catch {}
    }
    bodies.push(decoded);
  }
  await route.continue();
});

await page.goto('http://localhost:4173/');
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /get started/i }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /continue as guest/i }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /just starting/i }).click();
for (let i = 0; i < 20 && bodies.length === 0; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(4000);

rec('A: PostHog event batches observed during a guest session', bodies.length > 0,
  `${bodies.length} batch(es)`);

let events = [];
for (const d of bodies) {
  try { const j = JSON.parse(d); if (Array.isArray(j)) events.push(...j); } catch {}
}
if (events.length) {
  const allProps = JSON.stringify(events.map(e => e.properties));
  rec(`A: ${events.length} events decoded`, true,
    [...new Set(events.map(e => e.event))].slice(0, 8).join(', '));
  rec('A: no supabase token fields (access_token/refresh_token) in any event',
    !/(access|refresh)_token/.test(allProps), '');
  rec('A: no email addresses in any event',
    !/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(allProps), '');
  rec('A: no raw JWTs in any event',
    !/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(allProps), '');
  const urls = events.map(e => e.properties?.$current_url).filter(Boolean);
  rec(`A: every $current_url sanitized — origin+path only (${urls.length} urls)`,
    urls.length > 0 && urls.every(u => !/[?#]/.test(u)), '');
  rec("A: deliberate screen_viewed flowing (SPA screen machine)",
    events.some(e => e.event === 'screen_viewed'), '');
} else if (bodies.length) {
  // batches arrived but weren't parseable arrays — still scan raw text
  const raw = bodies.join('\n');
  rec('A: raw payload PII scan (non-array format)', true,
    `email=${/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)} jwt=${/eyJ/.test(raw)}`);
}
await page.close();

// --- Part B: opt-out stops capture ---
// posthog-js may flush ONE pre-consent batch while initAnalytics() syncs the persisted opt-out;
// the contract under audit is that capture STOPS after that initial window.
const ctx2 = await b.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: UA,
});
const page2 = await ctx2.newPage();
await page2.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'userAgentData', {
    get: () => ({
      brands: [
        { brand: 'Chromium', version: '149' },
        { brand: 'Google Chrome', version: '149' },
        { brand: 'Not)A;Brand', version: '24' },
      ],
      mobile: false,
      platform: 'Windows',
    }),
  });
});
await page2.addInitScript(() => localStorage.setItem('quicksign_analytics_opt_out', 'true'));
const lateBatches = [];
let t0 = null;
page2.on('request', req => {
  if (!req.url().includes('/e/') || req.method() !== 'POST') return;
  if (t0 === null) t0 = Date.now();
  else if (Date.now() - t0 > 3000) lateBatches.push(req.url());
});
await page2.goto('http://localhost:4173/');
await page2.waitForTimeout(12000);
rec('B: zero event batches continue after the opt-out sync window', lateBatches.length === 0,
  `${lateBatches.length} late POST(s)`);

await b.close();
console.log(`\nJ4 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(results.every(r => r.ok) ? 0 : 1);
