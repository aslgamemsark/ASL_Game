// Transient-vs-stable check for the color-contrast findings seen on the camera screens.
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
  await nav.getByRole('button', { name: /Alphabets/ }).first().click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(40);
    if (await page.evaluate(() =>
      document.activeElement?.tagName === 'BUTTON' &&
      /Practice Letters/i.test(document.activeElement.textContent || ''))) break;
  }
  await page.keyboard.press('Enter');
  for (const pat of [/(allow camera|continue|got it|start)/i, /(continue|start|i'm ready)/i]) {
    const btn = page.getByRole('button', { name: pat }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
    }
  }
  await page.getByText(/sign (it|quiz)|watch the sign|copy/i).first()
    .waitFor({ state: 'visible', timeout: 20000 });
  // Settle finite animations (a11y.spec.ts mechanics).
  for (let i = 0; i < 20; i++) {
    const anyFinite = await page.evaluate(() =>
      document.getAnimations().some(a => a.effect?.getTiming?.().iterations !== Infinity && a.playState === 'running'));
    if (!anyFinite) break;
    await page.waitForTimeout(300);
  }
  const collect = async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    return new Set(violations
      .filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
      .flatMap(v => v.nodes.map(n => v.id + '|' + n.target.join(' '))));
  };
  const run1 = await collect();
  await page.waitForTimeout(600);
  const run2 = await collect();
  const stable = [...run1].filter(x => run2.has(x));
  console.log('lesson run1:', run1.size, '| run2:', run2.size, '| STABLE:', stable.length);
  stable.forEach(s => console.log(' ', s));
  await b.close();
})();
