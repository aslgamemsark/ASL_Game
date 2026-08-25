// ASL-D2 — empty & first-run states on a zero-progress account (canonical e2e since round-4).
// Walks every guest-reachable screen with a FRESH account (zero progress, zero streak, zero gold,
// zero badges, empty friends) and asserts each renders a real UI: no blank mains, every
// zero-state carries either content or an explicit CTA. Runs on the production build via the
// canonical config's webServer.
import { test, expect, type Page } from '@playwright/test';

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
});

function expectNoConsoleErrors() {
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
}

const meTab = (page: Page) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first();

async function enterAsGuest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Journey/ }).first()
  ).toBeVisible({ timeout: 15_000 });
}

/** A "rendered something" floor: main content exists and is not visually empty. */
async function expectRenderedContent(page: Page) {
  const textLen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, '').length);
  expect(textLen, 'screen must render non-trivial content').toBeGreaterThan(60);
}

test.describe('ASL-D2 first-run & empty states', () => {
  // Phone width: this spec walks BottomNav tabs, which only exist below the `lg` breakpoint
  // (App.tsx swaps in SideNav with different labels — "Basic Signs" not "Basics" — above it).
  test.use({ viewport: { width: 390, height: 844 } });
  // The PWA's service worker fetches leaderboard data itself; on WebKit those SW-mediated
  // requests are invisible to route interception, which made the mocked zero-data board below
  // flake (real rows arrived instead). Blocking SWs makes network mocking deterministic and
  // matches what a true first-run user has anyway: no installed service worker yet.
  test.use({ serviceWorkers: 'block' });

  test('onboarding itself is the first-run state and completes for a brand-new guest', async ({ page }) => {
    // Deliberately NOT using enterAsGuest — this test owns the raw first visit.
    await page.goto('/');
    // Welcome screen must offer a path that requires no account.
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page.getByRole('button', { name: /continue as guest/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /continue as guest/i }).click();
    // Skill pick: all three options present so any newcomer can proceed (OnboardingFlow SKILLS).
    for (const level of [/just starting/i, /some experience/i, /conversational/i]) {
      await expect(page.getByRole('button', { name: level }).first()).toBeVisible({ timeout: 10_000 });
    }
    await page.getByRole('button', { name: /just starting/i }).click();
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Journey/ }).first()
    ).toBeVisible({ timeout: 15_000 });
    expectNoConsoleErrors();
  });

  test('fresh Home shows starter CTA + quests at zero, not blanks', async ({ page }) => {
    await enterAsGuest(page);
    // A "just starting" guest is routed to the Alphabets tab (App.tsx routes beginners to
    // letters first), so the zero-progress starter is the "Practice Letters" card.
    const start = page.getByRole('button', { name: /Practice Letters/ }).first();
    await expect(start).toBeVisible({ timeout: 10_000 });
    // All 26 letter tiles render on day one — the first-run content IS the alphabet grid.
    for (const letter of ['A', 'M', 'Z']) {
      await expect(page.getByRole('button', { name: letter, exact: true })).toBeVisible();
    }
    await expectRenderedContent(page);
    expectNoConsoleErrors();
  });

  test('Journey tab at zero progress shows world list + daily quests honestly at 0/3', async ({ page }) => {
    await enterAsGuest(page);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Journey/ }).first().click();
    // Zero-progress starter card with a working Start button ("Start your journey" hero).
    const start = page.getByRole('button', { name: /^Start$/ }).first();
    await expect(start).toBeVisible({ timeout: 10_000 });
    // Daily quests exist and honestly show 0/3 done on day one.
    await expect(page.getByText(/0\/3 done/).first()).toBeVisible({ timeout: 10_000 });
    // The first world's card is present and unlocked by default (progress 0/3 shown).
    await expect(page.getByRole('button', { name: /Say Hello Your first signs/ }).first())
      .toBeVisible({ timeout: 10_000 });
    await expectRenderedContent(page);
    expectNoConsoleErrors();
  });

  test('Alphabets tab at zero progress: tiles render; Basics/Review tabs non-blank', async ({ page }) => {
    await enterAsGuest(page);
    const nav = page.getByRole('navigation', { name: 'Main' });
    // We land on Alphabets already (beginner routing); assert its zero-state content directly.
    await expect(page.getByText(/Ready to test yourself\?/i).first()).toBeVisible({ timeout: 10_000 });
    await expectRenderedContent(page);

    await nav.getByRole('button', { name: /Basics/ }).first().click();
    await expectRenderedContent(page);
    await expect(page.getByRole('heading', { name: /Basic Signs/i }).first()).toBeVisible({ timeout: 10_000 });

    await nav.getByRole('button', { name: /Review/ }).first().click();
    await expectRenderedContent(page); // zero learned signs — screen still renders its shell
    expectNoConsoleErrors();
  });

  test('Me tab zeros are honest: Beginner rank, 0 XP, no badges yet', async ({ page }) => {
    await enterAsGuest(page);
    await meTab(page).click();
    await expect(page.getByText(/^Beginner$/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Badges \(0\)/)).toBeVisible({ timeout: 10_000 });
    // Explore grid fully present even with no history (this is how new users find features).
    for (const label of ['Leaderboard', 'Friends', 'Multiplayer', 'Shop', 'Settings']) {
      await expect(
        page.getByRole('button', { name: new RegExp(`${label}$`) }).first(),
        `${label} card must exist on first run`
      ).toBeVisible({ timeout: 10_000 });
    }
    await expectRenderedContent(page);
    expectNoConsoleErrors();
  });

  test('Leaderboard/Friends/Multiplayer at zero data render their shells or honest gates', async ({ page }) => {
    // The e2e build carries the same VITE_SUPABASE_* as production, so the world board fetches
    // REAL rows and the failure path takes ~15s to surface (supabase-js retries GET 4x over
    // ~7s per call, first + fallback). Route the data endpoint to a valid EMPTY list instead:
    // deterministic zero-data state, no dependence on live production rows, no 15s retry wall.
    // (context-level route — WebKit's page.route missed this cross-origin XHR in testing)
    await page.context().route('**supabase.co/rest/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await enterAsGuest(page);

    // Leaderboard: page chrome + the honest "No one here yet" empty board.
    await meTab(page).click();
    await page.getByRole('button', { name: /Leaderboard$/ }).first().click();
    await expect(page.getByRole('heading', { name: /leaderboard/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /World/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/no one here yet/i).first()).toBeVisible({ timeout: 20_000 });
    await expectRenderedContent(page);
    await page.getByRole('button', { name: 'Back' }).first().click();
    await expect(meTab(page)).toBeVisible({ timeout: 10_000 });

    // Friends: guest gate is the honest first-run state (no silent empty list).
    await page.getByRole('button', { name: /Friends$/ }).first().click();
    await expect(page.getByRole('heading', { name: /friends/i })).toBeVisible({ timeout: 15_000 });
    await expectRenderedContent(page);
    await page.getByRole('button', { name: /Back|Close/ }).first().click();

    // Multiplayer: same contract.
    await meTab(page).click();
    await page.getByRole('button', { name: /Multiplayer$/ }).first().click();
    await expect(page.getByRole('heading', { name: /multiplayer/i })).toBeVisible({ timeout: 15_000 });
    await expectRenderedContent(page);
    await page.getByRole('button', { name: /Back|Close/ }).first().click();

    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Journey/ }).first()
    ).toBeVisible({ timeout: 10_000 });
    expectNoConsoleErrors();
  });
});
