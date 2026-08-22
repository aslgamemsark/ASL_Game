// hermes-fakecam-e2e — ad-hoc verification (NOT part of the canonical suite)
// Validates the full camera→MediaPipe→recognition→UI pipeline in a real browser using
// Chrome's fake media device, which no existing e2e spec covers.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-adhoc',
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:4199',
    // Fake camera: animated synthetic video that MediaPipe can actually detect a "person" in
    // (it contains moving shapes incl. skin-tone-ish content). Permissions auto-granted.
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
    viewport: { width: 390, height: 844 }, // iPhone-ish
  },
  projects: [{ name: 'fakecam-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4199',
    url: 'http://localhost:4199',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_POSTHOG_KEY: '' },
  },
});
