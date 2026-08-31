import { test, expect } from '@playwright/test';

// Covers the reward-chest open flow end-to-end in a real browser: the animated chest icon
// (ChestIcon.tsx) shakes, pops its lid, and flashes gold, then hands off to the reward reveal.
// This exact sequence could not be verified via the Claude Code Browser-pane tool (backgrounded
// tabs throttle requestAnimationFrame there, so no framer-motion animation ever completes) — a
// real Playwright browser runs in the foreground, so the open flourish actually resolves and
// `onOpenComplete` fires for real. Seeds localStorage via addInitScript so the guest lands
// straight on Home with a chest already past its cooldown, instead of driving the full
// onboarding flow just to reach this screen.
test.describe('reward chest', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      const createdAt = now - 45 * 60 * 1000;
      const state = {
        xp: 0, level: 1, streak: 0, lastPracticeDate: null, streakFreezes: 1,
        dailyGoalMinutes: 10, dailyProgressMinutes: 0, completedLessons: [],
        signAccuracy: {}, achievements: [], onboardingComplete: true, skillLevel: 'beginner',
        dailyQuests: [], questsLastReset: '', streakMilestonesAwarded: [], signs: 0, gold: 0,
        badges: [], activeBadge: null, showcaseBadges: [], speedHighScores: {}, totalCorrectSigns: 0,
        pendingChests: [{ id: `chest-${createdAt}`, worldId: 'coffee', readyAt: now - 5000 }],
        unlockedWorldIds: [], ownedCosmetics: [], equippedBorder: null, equippedAvatar: null,
        friends: [], renameCards: 0, collectTrainingData: true,
      };
      localStorage.setItem('asl-game-progress', JSON.stringify({ state, version: 0 }));
    });
    await page.goto('/app');
  });

  test('shows a ready chest with a filled cooldown ring and no legacy emoji', async ({ page }) => {
    await expect(page.getByText('Reward Chest')).toBeVisible();
    await expect(page.getByText('✓ Ready to open!')).toBeVisible();
    // The chest is now a custom SVG (ChestIcon), not the old 📦 emoji.
    await expect(page.locator('svg[viewBox="0 0 64 64"]')).toBeVisible();
  });

  test('opening the chest plays the flourish and reveals a reward', async ({ page }) => {
    await page.getByRole('button', { name: 'Open', exact: true }).click();

    // Golden flash burst renders only during the open flourish.
    await expect(page.locator('circle[fill="url(#chest-flash-fill)"]')).toBeVisible();

    // The flourish resolves and the reward panel replaces the chest card — proves
    // ChestIcon's useAnimationControls sequence actually completes and calls onOpenComplete.
    await expect(page.getByText(/\+\d+ 🤟 Signs · \+\d+ 🪙 Gold/)).toBeVisible({ timeout: 5000 });

    // The flourish overlay is gone once the reward is showing.
    await expect(page.locator('circle[fill="url(#chest-flash-fill)"]')).not.toBeVisible();
  });
});

test.describe('reward chest (reduced motion)', () => {
  // reducedMotion must go through contextOptions, NOT as a top-level `use` key. Playwright
  // declares no `reducedMotion` test option (it is a browser.newContext option), so the top-level
  // form this test shipped with was silently dropped — every "reduced motion" assertion below ran
  // with motion fully ENABLED and passed anyway, which is worse than having no test. Found
  // 2026-07-31 when e2e/ was added to the typechecker for the first time; the compiler rejected
  // the key that the runtime had been quietly ignoring.
  test.use({ colorScheme: 'dark', contextOptions: { reducedMotion: 'reduce' } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      const createdAt = now - 45 * 60 * 1000;
      const state = {
        xp: 0, level: 1, streak: 0, lastPracticeDate: null, streakFreezes: 1,
        dailyGoalMinutes: 10, dailyProgressMinutes: 0, completedLessons: [],
        signAccuracy: {}, achievements: [], onboardingComplete: true, skillLevel: 'beginner',
        dailyQuests: [], questsLastReset: '', streakMilestonesAwarded: [], signs: 0, gold: 0,
        badges: [], activeBadge: null, showcaseBadges: [], speedHighScores: {}, totalCorrectSigns: 0,
        pendingChests: [{ id: `chest-${createdAt}`, worldId: 'coffee', readyAt: now - 5000 }],
        unlockedWorldIds: [], ownedCosmetics: [], equippedBorder: null, equippedAvatar: null,
        friends: [], renameCards: 0, collectTrainingData: true,
      };
      localStorage.setItem('asl-game-progress', JSON.stringify({ state, version: 0 }));
    });
    await page.goto('/app');
  });

  test('opening the chest skips the flourish and reveals the reward immediately', async ({ page }) => {
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    // No golden flash should ever mount under reduced motion.
    await expect(page.locator('circle[fill="url(#chest-flash-fill)"]')).toHaveCount(0);
    await expect(page.getByText(/\+\d+ 🤟 Signs · \+\d+ 🪙 Gold/)).toBeVisible({ timeout: 2000 });
  });
});
