import { defineConfig, devices } from '@playwright/test';

// Real end-to-end coverage was entirely absent (production audit, 2026-07-12) — 21+ unit test
// files covered pure logic (engine/avatar/classifier math) but zero tests ever drove the actual
// app in a browser: sign-up, onboarding, navigation. Deliberately narrow scope for now (see
// e2e/smoke.spec.ts) — camera-dependent flows (lesson/practice recognition) need a fake video
// device and are a separate, larger effort; this covers what's reachable without one.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Production build + preview, not `npm run dev` — matches what actually ships, and avoids
    // HMR/dev-only behavior masking a build-only bug.
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Force-unconfigure PostHog for this build: process.env wins over .env.local in Vite's env
    // precedence, so this guarantees the privacy-guard e2e test (health.spec.ts) is deterministic
    // regardless of whether the developer's local .env.local carries a real key for manual
    // analytics testing (see docs/analytics/DEVELOPER_GUIDE.md) — and prevents e2e runs from
    // sending real test traffic to the production PostHog project.
    env: { VITE_POSTHOG_KEY: '' },
  },
});
