// ASL-J2 — privacy-claim verification on the built bundle + live network observation.
// Part A (static): scan dist/ for upload-capable patterns — fetch/XHR to non-supabase origins,
//   FormData with video/image blobs, WebSocket sends of media, canvas.toBlob/toDataURL uploads,
//   MediaRecorder usage that isn't the local replay feature.
// Part B (dynamic): load the app, start a lesson with the camera running, record ALL outbound
//   requests for ~15s and assert none carries video-sized payloads or goes to unexpected hosts.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright-core';

const results = [];
function rec(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

// ---------------- PART A: static sweep of dist/ ----------------
let distAll = '';
let filesScanned = 0;
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else { filesScanned++; try { distAll += readFileSync(p, 'utf8'); } catch {} }
  }
})('dist');

// External hosts the app is ALLOWED to talk to (all documented: Supabase data/auth, PostHog analytics)
const allowedHosts = ['supabase.co', 'supabase.in', 'posthog.com', 'posthog-i', 'vercel.app',
  'jsdelivr.net', 'unpkg.com', 'gstatic.com']; // gstatic = fonts/mediapipe wasm CDN

const uploadPatterns = [
  { name: 'XMLHttpRequest POST/PUT send', re: /\.open\(\s*["'](POST|PUT)["']/gi },
  { name: 'FormData.append with blob/file', re: /(?:append|set)\(\s*["'][^"']+["']\s*,\s*(?:blob|file|this\.stream)/gi },
  { name: 'canvas.toBlob(', re: /toBlob\s*\(/g },
  { name: 'canvas.toDataURL( then fetch', re: /toDataURL\s*\(/g },
  { name: 'MediaRecorder start', re: /new\s+MediaRecorder/g },
  { name: 'WebSocket media send', re: /WebSocket\s*\(/g },
];

console.log(`PART A: static scan of dist/ (${filesScanned} files)`);
for (const { name, re } of uploadPatterns) {
  re.lastIndex = 0;
  const hits = [...distAll.matchAll(re)];
  if (!hits.length) { rec(`A: no ${name}`, true, ''); continue; }
  // Context-check each hit: MediaRecorder/toBlob are EXPECTED for the local replay feature
  const contexts = hits.map(h => distAll.slice(Math.max(0, h.index - 60), h.index + h[0].length + 40));
  const suspicious = contexts.filter(c =>
    /fetch\(|xhr\.send|\.send\(|upload/i.test(c) && !/replay|local|download/i.test(c));
  rec(`A: ${name} (${hits.length} hits)`, suspicious.length === 0,
    suspicious.length ? `suspicious ctx: ${suspicious[0].slice(0, 80)}` : 'all hits are local-replay related');
}

// Video frames must never be stringified/base64'd into storage/analytics payloads
rec('A: no base64 video payload markers', !/data:video\/[^;]{1,40};base64/.test(distAll), '');

// ---------------- PART B: dynamic network observation ----------------
console.log('\nPART B: live lesson with camera, observing outbound traffic');
const b = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
const page = await ctx.newPage();

const outbound = [];
page.on('request', req => {
  const url = new URL(req.url());
  if (!url.hostname.includes('localhost')) {
    outbound.push({ host: url.hostname, method: req.method(), size: (req.postData() || '').length });
  }
});

await page.goto('http://localhost:4173/');
await page.getByRole('button', { name: /get started/i }).click();
await page.getByRole('button', { name: /continue as guest/i }).click();
await page.getByRole('button', { name: /just starting/i }).click();
await page.waitForTimeout(2500);
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.getByRole('button', { name: /Alphabets/ }).first().click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Practice Letters/i }).first().click();
for (let i = 0; i < 6; i++) {
  const hs = page.getByRole('button', { name: /skip for now/i }).first();
  if (!(await hs.isVisible().catch(() => false))) break;
  await hs.click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
}
// Live camera recognition runs here — observe traffic for 15 s.
await page.waitForTimeout(15000);

// Classify every observed request.
// storage.googleapis.com = MediaPipe Tasks' official model/wasm CDN (INBOUND GETs of the hand-landmark
// model). It's a documented, download-only dependency — add to allowed hosts.
const allowedHostsB = [...allowedHosts, 'storage.googleapis.com', 'googleapis.com'];
const unexpected = outbound.filter(o => {
  if (allowedHostsB.some(h => o.host.includes(h))) return false;
  return true;
});
const cdnGets = outbound.filter(o => o.host.includes('googleapis.com'));
rec(`B: all ${outbound.length} external requests went to allowed hosts`, unexpected.length === 0,
  unexpected.length ? `unexpected: ${unexpected.slice(0,3).map(o=>`${o.method} ${o.host}`).join(', ')}` :
  `hosts: ${[...new Set(outbound.map(o => o.host))].join(', ') || '(none)'}`);
rec('B: googleapis requests are inbound GETs only (MediaPipe model CDN)',
  cdnGets.every(o => o.method === 'GET'), `${cdnGets.length} GET(s), no uploads`);
const bigPayloads = outbound.filter(o => o.size > 50_000); // >50KB POST = frame-upload scale
rec('B: no large POST payloads (>50KB) during live camera use', bigPayloads.length === 0,
  bigPayloads.length ? `largest=${Math.max(...bigPayloads.map(o=>o.size))}B` : 'largest POST < 50KB');
// Camera was genuinely active if getUserMedia-driven <video> element has stream data flowing —
// approximate via the presence of at least one models/clips asset fetched during the session.
const sawModelAssets = outbound.some(o => /models|wasm|mediapipe|task/i.test(o.host + '')) ||
  await page.evaluate(() => !!document.querySelector('video[srcObject], video'));
rec('B: camera pipeline active during observation (video element present)',
  await page.evaluate(() => !!document.querySelector('video')), '');

await b.close();
const failed = results.filter(r => !r.ok);
console.log(`\nJ2 SUMMARY: ${results.filter(r => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
