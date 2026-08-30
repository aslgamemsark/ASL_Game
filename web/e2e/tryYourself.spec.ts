import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * "Try Yourself" from a detail modal must actually land on Practice and STAY there.
 *
 * Regression test for an order violation between two `useBackDismiss` instances (see
 * hooks/useBackDismiss.ts). Reported 2026-08-06 as "the camera light comes on but I'm back on the
 * Alphabets page" — the camera opening is the tell that PracticePage really did mount, so this was
 * never the screen-never-mounts bug two earlier fixes targeted.
 *
 * Mechanism: closing the modal and switching screens happen in ONE click, so in one React commit
 * the modal's cleanup fires `history.back()` (asynchronous — it has not landed yet) while the
 * newly-armed screen-level instance pushes its own, deeper entry. The queued pop then lands on an
 * entry shallower than the screen's, which every listener reads as "the user pressed Back", and the
 * screen dismisses itself. "Test from Memory" has no modal to close, so it never queued a pop and
 * always worked — the exact asymmetry the bug report described.
 *
 * Asserted on the mechanism, not on one letter: the same click shape exists on Basic Signs, so both
 * are covered. The camera itself is out of scope here (no fake video device — see
 * playwright.config.ts); a denied camera still leaves us ON PracticePage, which is what this checks.
 */

async function openTab(page: Page, label: RegExp) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: label }).first().click();
}

/** The bounce is asynchronous (a queued popstate), so a bare "is Practice visible" assertion can
 *  pass in the frame before it happens. This waits past the pop, then asserts we are still gone
 *  from the tab we left — the assertion the bug actually violates. */
async function expectStaysOffHomeTab(page: Page, tabHeading: RegExp) {
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading', { name: tabHeading })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /back/i }).first()).toBeVisible();
}

test.describe('Try Yourself from a detail modal', () => {
  test('Alphabet: letter modal -> Try Yourself stays on Practice', async ({ page }) => {
    await completeOnboarding(page);
    await openTab(page, /Alphabets/);

    await page.getByRole('button', { name: 'A', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /try yourself/i }).click();

    await expectStaysOffHomeTab(page, /^Alphabet$/);
  });

  test('Basic Signs: sign modal -> Try Yourself stays on Practice', async ({ page }) => {
    await completeOnboarding(page);
    // Desktop SideNav labels it "Basic Signs", the mobile BottomNav "Basics" — both nav components
    // use aria-label="Main", so one regex covers all three device projects.
    await openTab(page, /Basics|Basic Signs/);

    // Whichever sign card is first — the defect is in the shared modal-close/screen-change click
    // shape, not in any one sign.
    const signList = page.locator('h3', { hasText: /Tap a sign to see it performed/ })
      .locator('xpath=following-sibling::div[1]');
    await signList.getByRole('button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /try yourself/i }).click();

    await expectStaysOffHomeTab(page, /^Basic Signs$/);
  });
});
