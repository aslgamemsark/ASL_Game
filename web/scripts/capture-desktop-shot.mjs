// One-off: capture a real desktop-viewport screenshot of the running app for the landing page's
// device-frame section (web/public/shots/desktop-home.png). Not a build script — run manually.
// Usage: node scripts/capture-desktop-shot.mjs
import { chromium } from '@playwright/test';

const PROGRESS = {
  state: {
    onboardingComplete: true, skillLevel: 'intermediate',
    xp: 640, level: 4, streak: 6, gold: 210, signs: 85,
    dailyGoalMinutes: 10, dailyProgressMinutes: 6,
    completedLessons: ['unit-0-lesson-1', 'unit-0-lesson-2'],
    unlockedWorldIds: ['greetings', 'coffee'],
  },
  version: 0,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });

await page.goto('http://localhost:5174');
await page.evaluate((progress) => {
  localStorage.setItem('asl-game-progress', JSON.stringify(progress));
  localStorage.setItem('asl-seen-landing', '1');
}, PROGRESS);
await page.reload();
await page.waitForSelector('text=Journey', { timeout: 15000 });
await page.waitForTimeout(600); // let entrance animations settle

await page.screenshot({ path: 'public/shots/desktop-home.png' });
await browser.close();
console.log('Saved public/shots/desktop-home.png');
