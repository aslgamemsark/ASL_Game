// hermes-explore-e2e — canonical e2e since ASL-A8 (round-4, 2026-08-25). Was `e2e-adhoc/explore.spec.ts`,
// which ran nowhere: outside testDir './e2e', no npm script, not in CI — a suite that reads as
// coverage but executes zero assertions. Moved into the canonical run with every probe made
// unconditional (the old `.catch(() => false)` wrappers could pass while asserting nothing) and
// its waits converted from fixed timeouts to state-based expectations.
//
// Walks guest-reachable screens in the PRODUCTION build asserting: no console errors, no dead
// ends (every screen has an exit affordance), and that double-clicks cannot wedge navigation.
import { test, expect, type Page } from '@playwright/test';
import { waitForAnimationsToSettle } from './helpers';

// F8 fix: this array was module-level and NEVER reset, so errors recorded in one test leaked into
// the next test's assertion within the same worker — a failure here could be caused by a different
// spec's page. A per-test array via beforeEach makes each test's console-error assertion about
// that test's pages only. (Playwright gives each test a fresh page; only the listener wiring was
// shared before.)
let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
});

/** Asserts THIS spec's own error filter is empty. Kept local to each test so the message names it. */
function expectNoConsoleErrors() {
  // favicon 404s are a dev-server artifact; posthog is force-unconfigured by the webServer env.
  expect(consoleErrors.filter((e) => !/favicon|posthog/i.test(e))).toEqual([]);
}

async function enterAsGuest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  // Home is settled when the Journey tab's content is visible — the same ready signal the rest of
  // e2e/ uses (navigation.spec.ts reachHome), replacing the old blind waitForTimeout.
  await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 15_000 });
}

/** Opens one of the Profile tab's "Explore" cards and asserts the destination screen rendered.
 *  The card click IS the navigation (ProfileTab → App.tsx setScreen); there is nothing else to
 *  press. An earlier version clicked the TopBar avatar here because its accessible name contains
 *  "Sign in" — but for a guest that only opens the AuthModal OVER whatever screen is up, it never
 *  navigates, and the stray dialog then swallowed every subsequent exit click. */
async function openExploreCard(page: Page, label: string) {
  await expect(page.getByRole('heading', { name: new RegExp(label) })).toBeVisible({ timeout: 10_000 });
}

// Scoped to the Main nav landmark: a bare /Me/ or /Leaderboard/ regex also matches content
// elsewhere ("Test from Memory" quiz cards contain "Me"; the Me tab lists a Leaderboard card),
// which is exactly how the first ios run mis-clicked into a Letter Test. Same pattern as
// a11y.spec.ts:142.
const meTab = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first();

test('desktop navigation keeps Explore hidden while every destination remains reachable', async ({ page }) => {
  await enterAsGuest(page);

  await meTab(page).click();
  await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeHidden();

  const nav = page.getByRole('navigation', { name: 'Main' }).first();
  for (const label of ['Leaderboard', 'Multiplayer', 'Friends', 'Settings']) {
    await expect(nav.getByRole('button', { name: new RegExp(`${label}$`) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Open shop' })).toBeVisible();
});

test('explore: Leaderboard, Multiplayer and Friends render content and exit back home', async ({ page }) => {
  await enterAsGuest(page);

  // All three live on the Me tab as labelled cards (ProfileTab.tsx "Explore" grid).
  for (const label of ['Leaderboard', 'Multiplayer', 'Friends']) {
    await meTab(page).click();
    // Anchored at the END (mobile.spec.ts's pattern): the accessible name is "🏆 Leaderboard" —
    // the emoji prefix means a ^ anchor matches nothing, while end-anchoring distinguishes the
    // card from other content that merely contains the word.
    const card = page.getByRole('button', { name: new RegExp(`${label}$`) }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    if (label === 'Leaderboard') {
      // Full page with HeaderBackButton ("Back") + <h1>.
      await expect(page.getByRole('heading', { name: /leaderboard/i })).toBeVisible({ timeout: 15_000 });
      await waitForAnimationsToSettle(page);
      const text = await page.evaluate(() => document.body.innerText.length);
      expect(text, `${label} rendered non-blank`).toBeGreaterThan(40);
      await page.getByRole('button', { name: 'Back' }).click();
    } else {
      // Multiplayer/Friends are full guest-gated PAGES (MultiplayerHubPage's !user branch /
      // FriendsPage), not modals over Home. Multiplayer's gate uses icon="close" (aria-label
      // "Close"); Friends' gate uses the default back arrow (aria-label "Back"). or() resolves
      // to whichever of the two exists on the current screen — no visibility race between
      // separate probes (isVisible() returns instantly and raced the entrance transition).
      await openExploreCard(page, label);
      const text = await page.evaluate(() => document.body.innerText.length);
      expect(text, `${label} rendered non-blank`).toBeGreaterThan(40);
      await page
        .getByRole('button', { name: 'Close' })
        .or(page.getByRole('button', { name: 'Back' }))
        .first()
        .click();
    }

    await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 10_000 });
    expectNoConsoleErrors();
  }
});

test('explore: Settings renders and Privacy & Terms opens from it and returns', async ({ page }) => {
  await enterAsGuest(page);

  // Settings is a card on the Me tab (spans both columns per ProfileTab.tsx).
  await meTab(page).click();
  const settingsCard = page.getByRole('button', { name: /Settings$/ }).first();
  await expect(settingsCard).toBeVisible({ timeout: 10_000 });
  await settingsCard.click();
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10_000 });
  await waitForAnimationsToSettle(page);
  const text1 = await page.evaluate(() => document.body.innerText.length);
  expect(text1).toBeGreaterThan(60);

  // Privacy & Terms is a real route (App.tsx type:'privacy') reached from Settings — assert it
  // actually navigated there and Back returns to Settings, instead of best-effort clicking.
  await page.getByRole('button', { name: /privacy/i }).first().click();
  await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible({ timeout: 10_000 });
  // HeaderBackButton renders aria-label="Back"; scope to the page header so the assertion stays
  // strict even if other "back"-named controls exist on the page.
  const backToSettings = page.getByRole('button', { name: 'Back' }).first();
  await backToSettings.click();
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Back' }).first().click();
  await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 10_000 });
  expectNoConsoleErrors();
});

test('explore: alphabet letter tiles open a detail dialog with Try Yourself; Escape dismisses', async ({ page }) => {
  await enterAsGuest(page);

  await page.getByRole('button', { name: /Alphabets/ }).first().click();
  // The letter grid is the settled state of this tab (AlphabetTab.tsx).
  const letterA = page.getByRole('button', { name: 'A', exact: true }).first();
  await expect(letterA).toBeVisible({ timeout: 10_000 });
  await letterA.click();

  // LetterDetailModal mounts a real role="dialog" named "Letter A" via useDialogA11y — assert the
  // dialog itself, not "some text appeared somewhere".
  const dialog = page.getByRole('dialog', { name: 'Letter A' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText(/try yourself/i)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  expectNoConsoleErrors();
});

test('explore: rapid double-clicks on nav do not wedge the app', async ({ page }) => {
  await enterAsGuest(page);

  const lb = meTab(page);
  for (let i = 0; i < 6; i++) { await lb.click({ delay: 30 }).catch(() => {}); }
  // The app must still respond: the Me tab's Settings card is present and clickable after the storm.
  const settingsCard = page.getByRole('button', { name: /Settings$/ }).first();
  await expect(settingsCard).toBeVisible({ timeout: 10_000 });

  await settingsCard.click();
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10_000 });
  await page.goBack();
  await expect(page.getByRole('button', { name: /Journey/ }).first()).toBeVisible({ timeout: 10_000 });
  expectNoConsoleErrors();
});

test('explore: browser Back from a lesson intro lands back where Back was handled', async ({ page }) => {
  await enterAsGuest(page);

  // Journey tab: Home shows the world list ("Say Hello" card, unlocked by default). Open it,
  // then click the current node's button — named "Lesson: Say Hello" via LessonNode's aria-label.
  await page.getByRole('button', { name: /Journey/ }).first().click();
  const worldCard = page.getByRole('button', { name: /Say Hello Your first signs/ }).first();
  await expect(worldCard).toBeVisible({ timeout: 10_000 });
  await worldCard.click();

  const nodeButton = page.getByRole('button', { name: 'Lesson: Say Hello' });
  await expect(nodeButton).toBeVisible({ timeout: 10_000 });
  // dispatchEvent, not click(): the node bobs forever (LessonNode idle-float) AND WorldMap
  // programmatic-scrolls to the first lesson on entry, so a coordinate-based force-click raced
  // that scroll and landed on the Basics nav tab (android failure snapshot). dispatchEvent fires
  // React's synthetic handler directly on THIS element — no hit-testing to race.
  await nodeButton.dispatchEvent('click');

  // The lesson intro shows a Start Signing button (LessonPage intro phase).
  await expect(page.getByRole('button', { name: /Start Signing|Continue/i })).toBeVisible({ timeout: 20_000 });

  // Hardware/browser Back must return toward Home, not exit the app (popstate contract).
  await page.goBack();
  await expect(
    page.getByRole('button', { name: /Journey|Start Signing|Continue/i }).first()
  ).toBeVisible({ timeout: 10_000 });
  expectNoConsoleErrors();
});
