import { defineConfig, devices } from '@playwright/test';

// Throwaway config: runs the e2e specs against LIVE production instead of a local preview
// server, to verify a deploy actually landed. Not part of CI — `playwright.config.ts` is the gate.
export default defineConfig({
  testDir: './e2e',
  testIgnore: /multiplayer\.spec\.ts/,
  workers: 2,
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: process.env.PROD_URL ?? 'https://quicksignn.vercel.app' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
});
