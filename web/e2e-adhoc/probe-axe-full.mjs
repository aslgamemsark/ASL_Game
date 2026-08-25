// ASL-E1 — full axe sweep with RAW violation reporting (ad-hoc, not part of the canonical suite).
//
// The canonical a11y.spec.ts is a GATE: it fails only on serious/critical violations that survive
// two agreeing scans, and it discards everything else. E1's job is the opposite — an AUDIT that
// reports ALL findings (every impact level, every rule) so nothing is invisible behind the gate's
// threshold. It reuses a11y.spec.ts's proven mechanics (settle-wait + double-scan agreement) but
// prints the full picture per page instead of asserting.
//
// Pages: every guest-reachable surface at phone width (390x844). Production build via :4173.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();

async function settle(page) {
  // Same rationale as a11y.spec.ts: wait out finite entrance animations; exclude infinite ones.
  for (let i = 0; i < 20; i++) {
    const anyFinite = await page.evaluate(() =>
      document.getAnimations().some(a => a.effect?.getTiming?.().iterations !== Infinity && a.playState === 'running')
    );
    if (!anyFinite) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
}

/** Double-scan; report union by impact. Agreement filter applied only in the summary table. */
async function scan(label) {
  await settle(page);
  const run = async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    return violations.map(v => ({
      id: v.id, impact: v.impact ?? 'unknown', help: v.help,
      nodes: v.nodes.map(n => n.target.join(' ')),
    }));
  };
  const first = await run();
  await page.waitForTimeout(400);
  const second = await run();
  const key = v => `${v.id}|${v.nodes.join(',')}`;
  const stable = first.filter(v => second.some(w => key(v) === key(w)));
  const all = [...new Map([...first, ...second].map(v => [key(v), v])).values()];

  console.log(`\n=== ${label} ===`);
  if (all.length === 0) { console.log('  no axe findings at all'); return { label, all, stable }; }
  for (const v of all.sort((a, c) => a.impact.localeCompare(c.impact))) {
    const stableFlag = stable.some(s => key(s) === key(v)) ? 'STABLE' : 'transient';
    console.log(`  [${v.impact}]${stableFlag === 'STABLE' ? '*' : ' '} ${v.id} x${v.nodes.length} — ${v.help}`);
    if (stableFlag === 'STABLE') for (const t of v.nodes.slice(0, 3)) console.log(`        ${t.slice(0, 90)}`);
  }
  return { label, all, stable };
}

await page.goto(BASE);
await page.getByRole('button', { name: /get started/i }).click();
await page.getByRole('button', { name: /continue as guest/i }).click();
await page.getByRole('button', { name: /just starting/i }).click();
const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
await nav.waitFor({ state: 'visible', timeout: 15000 });

const results = [];
results.push(await scan('home / journey'));
for (const tab of ['Alphabets', 'Basics', 'Review']) {
  await nav.getByRole('button', { name: new RegExp(tab) }).first().click();
  await page.waitForTimeout(600);
  results.push(await scan(`home tab ${tab}`));
  await nav.getByRole('button', { name: /Journey/ }).first().click();
  await page.waitForTimeout(400);
}
await nav.getByRole('button', { name: /Me/ }).first().click();
await page.waitForTimeout(600);
results.push(await scan('home tab Me'));

for (const name of ['Leaderboard', 'Friends', 'Multiplayer', 'Settings']) {
  await nav.getByRole('button', { name: /Me/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: new RegExp(`${name}$`) }).first().click();
  await page.waitForTimeout(800);
  results.push(await scan(name.toLowerCase()));
  await page.goto(BASE);
  await page
    .getByRole('button', { name: /Journey/ })
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });
}

// Feedback dialog open (guest-reachable in two clicks).
await nav.getByRole('button', { name: /Me/ }).first().click();
await page.getByRole('button', { name: /Settings$/ }).first().click();
await page.getByRole('button', { name: /send feedback/i }).click();
await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
results.push(await scan('feedback dialog'));

console.log('\n===== E1 SUMMARY (stable findings across double-scan) =====');
let totalStable = 0;
for (const r of results) {
  const serious = r.stable.filter(v => ['serious', 'critical'].includes(v.impact));
  totalStable += r.stable.length;
  console.log(`${r.label}: ${r.all.length} raw / ${r.stable.length} stable / ${serious.length} serious+`);
  for (const v of serious) console.log(`   [${v.impact}] ${v.id} — ${v.help}`);
}
console.log(`TOTAL stable findings: ${totalStable}`);
await b.close();
