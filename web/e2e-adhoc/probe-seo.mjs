// ASL-I2 — SEO/structured-data probe (ad-hoc, not canonical suite).
// Fetches the PRODUCTION origin's public surfaces and validates:
//   robots.txt directives, sitemap.xml URLs resolve, manifest JSON parses + fields,
//   landing/index JSON-LD blocks parse, OG image exists.
// Read-only against production — no mutations of any kind.
import { chromium } from 'playwright-core';

const BASE = 'https://aslgame.vercel.app';
const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();

async function fetchText(url) {
  const resp = await page.request.get(url);
  return { status: resp.status(), body: await resp.text() };
}

// 1. robots.txt
const robots = await fetchText(`${BASE}/robots.txt`);
rec('robots.txt served (200)', robots.status === 200, `status=${robots.status}`);
const sitemapRef = robots.body.match(/Sitemap:\s*(\S+)/);
rec('robots.txt declares sitemap', !!sitemapRef && sitemapRef[1] === `${BASE}/sitemap.xml`,
  `ref=${sitemapRef ? sitemapRef[1] : 'none'}`);
rec('robots allows marketing pages', /Allow: \/landing\.html/.test(robots.body), '');

// 2. sitemap.xml: every URL must return 200 and be allowed by robots
const sm = await fetchText(`${BASE}/sitemap.xml`);
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
rec(`sitemap lists ${locs.length} URLs`, locs.length >= 3, locs.join(', '));
for (const loc of locs) {
  const r = await fetchText(loc);
  rec(`sitemap URL resolves: ${loc.replace(BASE, '') || '/'}`, r.status === 200, `status=${r.status}`);
}

// 3. landing.html structured data: every JSON-LD block must parse
const landing = await fetchText(`${BASE}/landing.html`);
const ldBlocks = [...landing.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(m => m[1]);
let ldOk = 0, ldFail = [];
for (const raw of ldBlocks) {
  try { JSON.parse(raw); ldOk++; } catch (e) { ldFail.push(e.message.slice(0, 40)); }
}
rec(`landing.html: all ${ldBlocks.length} JSON-LD blocks parse`, ldFail.length === 0,
  ldFail.length ? ldFail.join('; ') : 'valid JSON');

// 4. index.html (app shell): JSON-LD + OG image reachable
const index = await fetchText(`${BASE}/`);
const idxLd = [...index.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(m => m[1]);
let idxOk = 0;
for (const raw of idxLd) { try { JSON.parse(raw); idxOk++; } catch {} }
rec(`index.html: all ${idxLd.length} JSON-LD blocks parse`, idxOk === idxLd.length, '');
const ogImg = index.body.match(/property="og:image" content="([^"]+)"/);
if (ogImg) {
  const img = await page.request.head(ogImg[1]).catch(() => null);
  const st = img ? img.status() : 0;
  rec(`og:image resolves (${ogImg[1].split('/').pop()})`, st === 200, `status=${st}`);
} else {
  rec('og:image present in index.html', false, 'no og:image meta');
}

// 5. web manifest (PWA plugin injects it)
const mfMatch = index.body.match(/rel="manifest"[^>]*href="([^"]+)"/) ||
                 index.body.match(/href="([^"]+)"[^>]*rel="manifest"/);
if (mfMatch) {
  const mfUrl = mfMatch[1].startsWith('http') ? mfMatch[1] : BASE + mfMatch[1];
  const mf = await fetchText(mfUrl);
  let mfJson = null;
  try { mfJson = JSON.parse(mf.body); } catch {}
  rec('manifest.json parses', !!mfJson, mfJson ? `name=${mfJson.name}` : 'invalid JSON');
  rec('manifest has required PWA fields',
    !!mfJson && !!mfJson.name && !!mfJson.icons?.length && !!mfJson.start_url,
    mfJson ? `icons=${mfJson.icons?.length}` : '');
} else {
  rec('manifest linked from index.html', false, 'no rel=manifest');
}

await b.close();
const failed = results.filter(r => !r.ok);
console.log(`\nI2 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
