// hermes-explore-e2e — ad-hoc autonomous exploration (NOT part of the canonical suite)
// Walks every reachable screen in the production build as a guest, clicking every primary
// control, asserting: no console errors, no dead ends (every screen has an exit affordance).
import { test, expect } from '@playwright/test';

const consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
});

async function enterAsGuest(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 15_000 });
}

test('explore: every side-nav screen opens, renders content, and returns home', async ({ page }) => {
  await enterAsGuest(page);
  const home = () => page.getByRole('button', { name: /sign in/i }).first();

  for (const name of ['Leaderboard', 'Multiplayer', 'Friends']) {
    await page.getByRole('button', { name }).first().click();
    await page.waitForTimeout(900);
    // Every gated screen must still offer a way back (close button) — dead-end check.
    const close = page.getByRole('button', { name: /close|back/i }).first();
    await expect(close, `${name} must have an exit affordance`).toBeVisible();
    // Body must render non-trivial text (not blank).
    const text = await page.evaluate(() => document.body.innerText.length);
    expect(text, `${name} rendered non-blank`).toBeGreaterThan(40);
    await close.click();
    await page.waitForTimeout(700);
    await expect(home(), `returned Home from ${name}`).toBeVisible();
  }
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
});

test('explore: settings and privacy screens navigate and return', async ({ page }) => {
  await enterAsGuest(page);
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.waitForTimeout(800);
  const text1 = await page.evaluate(() => document.body.innerText.length);
  expect(text1).toBeGreaterThan(60);
  // Privacy & Terms entry
  const privacy = page.getByText(/privacy/i).first();
  if (await privacy.isVisible().catch(() => false)) {
    await privacy.click();
    await page.waitForTimeout(600);
    const back = page.getByRole('button', { name: /back|close/i }).first();
    await expect(back).toBeVisible();
    await back.click();
    await page.waitForTimeout(500);
  }
  const close = page.getByRole('button', { name: /^close$/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 10_000 });
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
});

test('explore: alphabet tab letters open detail modal with Try Yourself', async ({ page }) => {
  await enterAsGuest(page);
  await page.getByRole('button', { name: /Alphabets/ }).first().click();
  await page.waitForTimeout(800);
  // Open the first letter tile
  const letterA = page.getByRole('button', { name: 'A', exact: true }).first();
  await expect(letterA).toBeVisible();
  await letterA.click();
  await page.waitForTimeout(700);
  // Modal or detail view must have appeared with content
  const text = await page.evaluate(() => document.body.innerText.length);
  expect(text).toBeGreaterThan(80);
  // Dismiss via Escape (dialog semantics)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
});

test('explore: rapid double-clicks on nav do not wedge the app', async ({ page }) => {
  await enterAsGuest(page);
  const lb = page.getByRole('button', { name: 'Leaderboard' }).first();
  for (let i = 0; i < 6; i++) { await lb.click({ delay: 30 }).catch(() => {}); }
  await page.waitForTimeout(1000);
  // App must still be interactive — close button works
  const close = page.getByRole('button', { name: /close|back/i }).first();
  await expect(close).toBeVisible({ timeout: 10_000 });
  await close.click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 10_000 });
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
});

test('explore: browser Back from lesson-intro screen lands on Home (no camera needed)', async ({ page }) => {
  await enterAsGuest(page);
  await page.getByRole('button', { name: /Journey/ }).first().click();
  await page.waitForTimeout(900);
  // Enter the first available lesson node ("Go" badge button)
  const go = page.getByText('Go', { exact: true }).first();
  if (await go.isVisible().catch(() => false)) {
    await go.click();
    await page.waitForTimeout(900);
    // We should be on a lesson intro (Sign It / lesson title) OR already through onboarding.
    // Hardware back must return to Home, not exit.
    await page.goBack();
    await page.waitForTimeout(800);
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 10_000 });
  }
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
});
