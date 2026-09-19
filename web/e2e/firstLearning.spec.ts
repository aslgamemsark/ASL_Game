import { test, expect, type Page } from '@playwright/test';

// Real screens, camera and model lifecycle; only the external model and telemetry SDK are
// substituted. These tests check recovery/reporting, not linguistic recognition accuracy.
async function openScreen(page: Page, screen: 'onboarding' | 'practice' | 'lesson', manualPass = false) {
  await page.addInitScript(() => {
    localStorage.setItem('signup-camera-onboarded', '1');
    localStorage.setItem('asl-game-hand-check-done', 'true');
  });
  await page.route('**/src/analytics/client.ts', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.__learningEvents = [];
      const ph = {
        capture: (event, properties) => window.__learningEvents.push({event, properties}),
        identify() {}, alias() {}, reset() {}, group() {},
        isFeatureEnabled: () => false, onFeatureFlags: () => () => {},
      };
      export const analyticsConfigured = true;
      export const registerAnalyticsContext = () => {};
      export const initAnalytics = async () => {};
      export const getPosthog = () => ph;
      export const whenAnalyticsReady = cb => cb();
      export const sanitizeAnalyticsProperties = value => value;
    `,
  }));
  await page.route('**/node_modules/.vite/deps/@mediapipe_tasks-vision.js*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.__learningModel = { fail: true, attempts: 0, frames: 0, throwNext: false };
      export const FilesetResolver = { forVisionTasks: async () => {
        window.__learningModel.attempts++;
        if (window.__learningModel.fail) throw new Error('Simulated model download failure');
        return {};
      }};
      const landmarker = { createFromOptions: async () => ({
        detectForVideo: () => {
          window.__learningModel.frames++;
          if (window.__learningModel.throwNext) {
            window.__learningModel.throwNext = false;
            throw new Error('Simulated transient frame error');
          }
          return { landmarks: [], handedness: [] };
        }, close() {},
      }) };
      export const HandLandmarker = landmarker;
      export const PoseLandmarker = landmarker;
      export const FaceLandmarker = landmarker;
    `,
  }));
  if (manualPass) {
    await page.route('**/src/hooks/useRecognition.ts', route => route.fulfill({
      contentType: 'application/javascript',
      body: `
        const api = {status: 'ready', result: null, framing: null, holdProgress: null,
          init: async () => {}, startLoop() {}, stopLoop() {}, setSign() {}, getSnapshot: () => []};
        export function useRecognition(opts) {
          window.__learningPass = signId => {
            opts.onAttempt?.({signId, rulePassed: true, finalPassed: true, aiPrediction: null,
              aiConfidence: null, aiVetoed: false, frames: [], durationMs: 2500, attemptNumber: 1});
            opts.onPass?.({signName: signId, params: [], roles: {}});
          };
          return api;
        }
      `,
    }));
  }
  const module = screen === 'onboarding'
    ? 'components/onboarding/OnboardingFlow'
    : screen === 'practice' ? 'pages/PracticePage' : 'pages/LessonPage';
  const component = screen === 'onboarding' ? 'OnboardingFlow' : screen === 'practice' ? 'PracticePage' : 'LessonPage';
  const props = screen === 'onboarding'
    ? `{ initialStep: 'skill', onComplete() {} }`
    : screen === 'practice'
      ? `{ filterSignIds: ['LETTER_A'], autoStartExpressive: true, onExit() {} }`
      : `{ lessonId: 'greetings-intro', onExit() {} }`;
  await page.route('**/src/App.tsx', route => route.fulfill({
    contentType: 'application/javascript',
    body: `import React from '/node_modules/.vite/deps/react.js';
      import { ${component} } from '/src/${module}.tsx';
      export default function App() { return React.createElement(${component}, ${props}); }`,
  }));
  await page.goto('/');
  if (screen === 'onboarding') {
    await page.getByRole('button', { name: /just starting/i }).click();
  }
}

async function events(page: Page, eventName: string) {
  return page.evaluate(name => {
    const state = window as unknown as { __learningEvents: { event: string; properties: Record<string, unknown> }[] };
    return state.__learningEvents.filter(entry => entry.event === name).map(entry => entry.properties);
  }, eventName);
}

async function allowModelLoad(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __learningModel: { fail: boolean } }).__learningModel.fail = false;
  });
}

async function passSign(page: Page, signId: string) {
  await page.evaluate(id => {
    (window as unknown as { __learningPass: (sign: string) => void }).__learningPass(id);
  }, signId);
}

test('onboarding exposes model failure and retry resumes camera processing', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined }));
  await openScreen(page, 'onboarding');
  await expect(page.getByText("Sign recognition couldn't load", { exact: true })).toBeVisible();
  await allowModelLoad(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __learningModel: { frames: number } }).__learningModel.frames,
  )).toBeGreaterThan(0);
  await expect(page.getByText("Sign recognition couldn't load", { exact: true })).toHaveCount(0);

  // Also recover after a loop has already started (for example, a camera unplugged mid-sign).
  await page.evaluate(() => {
    const video = [...document.querySelectorAll('video')].find(candidate => candidate.srcObject);
    const track = (video!.srcObject as MediaStream).getVideoTracks()[0];
    if (!track) throw new Error('Expected an active camera track before simulating failure');
    track.stop();
    track.dispatchEvent(new Event('ended'));
  });
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  const framesBeforeRetry = await modelFrames(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => modelFrames(page)).toBeGreaterThan(framesBeforeRetry);
  const beforeError = await modelFrames(page);
  await page.evaluate(() => {
    (window as unknown as { __learningModel: { throwNext: boolean } }).__learningModel.throwNext = true;
  });
  await expect.poll(() => modelFrames(page)).toBeGreaterThan(beforeError + 4);
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect.poll(async () => (await events(page, 'recognition_run_ended')).at(-1)?.outcome).toBe('skipped');
});

test('Practice retries the failed model as well as the camera', async ({ page }) => {
  await openScreen(page, 'practice');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await allowModelLoad(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __learningModel: { frames: number } }).__learningModel.frames,
  )).toBeGreaterThan(0);
});

test('onboarding pass reports the shared first success once', async ({ page }) => {
  await openScreen(page, 'onboarding', true);
  await page.getByRole('button', { name: 'Turn on camera', exact: true }).click();
  await expect(page.getByText('Sign the letter A', { exact: true })).toBeVisible();
  await passSign(page, 'LETTER_A');
  await expect(page.getByText('You got it! 🎉', { exact: true })).toBeVisible();
  await expect.poll(() => events(page, 'first_sign_success')).toEqual([
    expect.objectContaining({ sign_id: 'LETTER_A', source: 'onboarding', flow_version: 3 }),
  ]);
  await expect.poll(() => events(page, 'sign_attempt')).toEqual([
    expect.objectContaining({ sign_id: 'LETTER_A', source: 'onboarding', final_passed: true }),
  ]);
  await passSign(page, 'LETTER_A');
  expect(await events(page, 'first_sign_success')).toHaveLength(1);
  expect(await events(page, 'onboarding_first_sign_passed')).toHaveLength(1);
});

test('skipping onboarding does not record a successful sign', async ({ page }) => {
  await openScreen(page, 'onboarding', true);
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  expect(await events(page, 'first_sign_success')).toEqual([]);
  expect(await events(page, 'sign_attempt')).toEqual([]);
});

for (const finalOutcome of ['skip', 'pass'] as const) {
  test(`lesson final ${finalOutcome} records completion once with the full earned XP`, async ({ page }) => {
    await openScreen(page, 'lesson', true);
    await page.getByRole('button', { name: /start signing/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    if (finalOutcome === 'skip') {
      await passSign(page, 'PLEASE');
      await expect(page.getByRole('button', { name: /skip/i })).toBeVisible();
      await page.getByRole('button', { name: /skip/i }).click();
    } else {
      await page.getByRole('button', { name: /skip/i }).click();
      await passSign(page, 'YOU');
    }
    await expect(page.getByRole('heading', { name: /lesson/i })).toBeVisible();
    await expect(page.getByText('1/3', { exact: true })).toBeVisible();
    await expect.poll(() => events(page, 'lesson_completed')).toEqual([
      expect.objectContaining({ lesson_id: 'greetings-intro', xp_earned: 10 }),
    ]);
    await passSign(page, 'YOU');
    expect(await events(page, 'lesson_completed')).toHaveLength(1);
  });
}

async function modelFrames(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __learningModel: { frames: number } }).__learningModel.frames,
  );
}

test('final lesson skip stops the running recognition loop', async ({ page }) => {
  await openScreen(page, 'lesson');
  await page.getByRole('button', { name: /start signing/i }).click();
  await allowModelLoad(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => modelFrames(page)).toBeGreaterThan(0);
  for (const sign of ['HELLO', 'PLEASE', 'YOU']) {
    await expect(page.getByRole('heading', { name: `Sign: ${sign}`, exact: true })).toBeVisible();
    // The dev-only recognition overlay overlaps Skip; exercise its normal keyboard activation.
    await page.getByRole('button', { name: /skip/i }).press('Enter');
  }
  await expect.poll(() => events(page, 'lesson_completed')).toEqual([
    expect.objectContaining({ lesson_id: 'greetings-intro', xp_earned: 0 }),
  ]);
  const framesAtCompletion = await modelFrames(page);
  // Allow several recognition ticks: completion must leave the frame count unchanged.
  await page.waitForTimeout(300);
  expect(await modelFrames(page)).toBe(framesAtCompletion);
  const runs = await events(page, 'recognition_run_ended');
  expect(runs).toHaveLength(3);
  expect(runs.every(run => run.outcome === 'skipped')).toBe(true);
  expect(new Set(runs.map(run => run.run_id)).size).toBe(3);
});
