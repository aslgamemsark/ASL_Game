// Identify which element keeps a CSS Animation running under prefers-reduced-motion on Me tab.
import { chromium } from 'playwright-core';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage();
await p.goto('http://localhost:4173/');
await p.getByRole('button', { name: /get started/i }).click();
await p.getByRole('button', { name: /continue as guest/i }).click();
await p.getByRole('button', { name: /just starting/i }).click();
await p.locator("nav[aria-label='Main']").last().waitFor({ state: 'visible', timeout: 15000 });
await p.locator("nav[aria-label='Main']").last().getByRole('button', { name: /Me/ }).first().click();
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    for (const a of (el.getAnimations ? el.getAnimations() : [])) {
      if (a.playState === 'running') {
        out.push({
          tag: el.tagName,
          cls: el.className.toString().slice(0, 140),
          name: a.animationName,
          dur: a.effect?.getTiming?.().duration,
          iter: a.effect?.getTiming?.().iterations,
          html: el.outerHTML.slice(0, 200),
        });
      }
    }
  }
  return out.slice(0, 5);
});
console.log(JSON.stringify(info, null, 1));
await b.close();
