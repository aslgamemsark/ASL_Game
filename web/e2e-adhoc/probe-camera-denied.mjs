// Isolate check 5: does the getUserMedia override actually reach the page before the app's
// module code captures mediaDevices? Debug what LessonPage shows when gUM rejects NotAllowedError.
import { chromium } from 'playwright-core';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.on('console', m => { if (/camera|denied|error/i.test(m.text())) console.log('PAGE:', m.text().slice(0, 100)); });
await p.addInitScript(() => {
  const md = navigator.mediaDevices;
  Object.defineProperty(md, 'getUserMedia', {
    value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    configurable: true,
  });
  window.__gumOverridden = true;
});
await p.goto('http://localhost:4173/');
console.log('override present:', await p.evaluate(() => window.__gumOverridden));
await p.getByRole('button', { name: /get started/i }).click();
await p.getByRole('button', { name: /continue as guest/i }).click();
await p.getByRole('button', { name: /just starting/i }).click();
await p.locator("nav[aria-label='Main']").last().waitFor({ state: 'visible', timeout: 15000 });
await p.locator("nav[aria-label='Main']").last().getByRole('button', { name: /Alphabets/ }).first().click();
await p.getByRole('button', { name: /Practice Letters/i }).first().click();
const allow = p.getByRole('button', { name: /Allow Camera/i });
if (await allow.isVisible().catch(() => false)) {
  console.log('camera onboarding gate visible; clicking Allow');
  await allow.click();
}
for (let t = 4; t <= 20; t += 4) {
  await p.waitForTimeout(4000);
  const state = await p.evaluate(() => ({
    denied: !!document.body.innerText.match(/Camera access denied/i),
    unavailable: !!document.body.innerText.match(/Camera unavailable/i),
    stalled: !!document.body.innerText.match(/isn't showing/i),
    recognizer: !!document.body.innerText.match(/recognizer/i),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120),
  }));
  console.log(`t=${t}s`, JSON.stringify(state));
  if (state.denied || state.unavailable) break;
}
await b.close();
