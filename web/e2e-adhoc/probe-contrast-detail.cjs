// Identify the persistent color-contrast findings on the Practice mode chooser.
const AxeBuilder = require('@axe-core/playwright').default;
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  const nav = page.locator("nav[aria-label='Main']").filter({ visible: true }).first();
  await nav.waitFor({ state: 'visible' });
  await nav.getByRole('button', { name: /Review/ }).first().click();
  await page.waitForTimeout(600);
  const t = page.getByRole('button', { name: /quick session/i }).first();
  if (!(await t.isVisible().catch(() => false))) { console.log('entry missing'); process.exit(1); }
  await t.click();
  await page.getByText(/sign (it|quiz)|choose a mode|what sign/i).first()
    .waitFor({ state: 'visible', timeout: 15000 });
  for (let i = 0; i < 20; i++) {
    const anyFinite = await page.evaluate(() =>
      document.getAnimations().some(a => a.effect?.getTiming?.().iterations !== Infinity && a.playState === 'running'));
    if (!anyFinite) break;
    await page.waitForTimeout(300);
  }
  // Double-scan agreement, per a11y.spec.ts doctrine.
  const collect = async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    return violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
      .map(v => ({ id: v.id, nodes: v.nodes }));
  };
  const r1 = await collect();
  await page.waitForTimeout(600);
  const r2 = await collect();
  const key = n => n.target.join(' ');
  for (const v of r1) {
    if (!['serious', 'critical'].includes(v.impact)) continue;
    const stableNodes = v.nodes.filter(n => r2.some(w => w.id === v.id && w.nodes.some(m => key(m) === key(n))));
    console.log(`${v.id} (${v.impact}): run1=${v.nodes.length} stable=${stableNodes.length}`);
    for (const n of stableNodes.slice(0, 4)) {
      console.log('   target:', n.target.join(' '));
      console.log('   why:', (n.failureSummary || '').replace(/\n/g, ' ').slice(0, 130));
      console.log('   html:', (n.html || '').slice(0, 110));
    }
  }
  await b.close();
})();
