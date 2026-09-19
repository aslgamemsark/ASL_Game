import { defineConfig, devices } from '@playwright/test';

// Dev modules let these tests replace external model/telemetry dependencies while exercising
// the real React screens and hooks. The regular smoke suite separately checks production builds.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'firstLearning.spec.ts',
  workers: 1,
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4187',
    serviceWorkers: 'block',
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://localhost:4187',
    env: { VITE_POSTHOG_KEY: '', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    timeout: 60_000,
  },
});
