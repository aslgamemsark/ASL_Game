import { defineConfig, devices } from '@playwright/test';

// Real end-to-end coverage was entirely absent (production audit, 2026-07-12) — 21+ unit test
// files covered pure logic (engine/avatar/classifier math) but zero tests ever drove the actual
// app in a browser: sign-up, onboarding, navigation. Deliberately narrow scope for now (see
// e2e/smoke.spec.ts) — camera-dependent flows (lesson/practice recognition) need a fake video
// device and are a separate, larger effort; this covers what's reachable without one.
export default defineConfig({
  testDir: './e2e',
  // The multiplayer suite has its own config (playwright.multiplayer.config.ts): its own port, its
  // own build pointed at a LOCAL Supabase stack, fake-media launch flags, and serial workers.
  // Without this it is also collected here — 60 extra cases across the three device projects,
  // running against the wrong webServer. They currently skip (assertLocalOnly defaults to
  // localhost), so the only visible symptom was skip-count noise, but "harmless because a guard
  // happens to catch it" is not a reason to leave a suite pointed at the wrong build.
  // security-rls.spec.ts is excluded here for exactly the reason stated above: it belongs to
  // playwright.multiplayer.config.ts, which supplies the local Supabase stack it needs. Left in,
  // it would skip on every run of this suite across all three device projects — the same
  // skip-count noise, and the same "a suite pointed at the wrong build" problem.
  testIgnore: /(multiplayer|security-rls)\.spec\.ts/,
  fullyParallel: true,
  // Capped deliberately. Playwright defaults to half the core count (8 here), but each worker is a
  // full browser engine driving React + framer-motion, and the axe sweeps pin a core for seconds at
  // a time. At 8 the suite starved itself: a different test failed on each run, always WebKit,
  // always "onboarding did not reach Home in 15s" rather than a real assertion — the signature of
  // CPU contention, not a code path. It is not the app being slow: a cold load of the production
  // bundle measures 130ms on WebKit (vs 1.8s on Chromium). At 4 the full suite passes repeatedly.
  // A gate that cannot tell "app broken" from "machine busy" is not a gate.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // Playwright's 30s default was sized when this suite had one project. It now runs three device
  // projects fully in parallel, so workers contend for CPU and the longest tests — the axe sweeps,
  // which do four to five full page loads plus a scan each — exceed it. Measured uncontended on
  // WebKit: 18.0s and 22.8s, already 60-76% of the old budget before any contention. This is not
  // masking a slow app: a cold load of the production bundle measures 130ms on WebKit and 1.8s on
  // Chromium, so page load is not the cost here — the axe scans are.
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // Mobile parity audit (2026-07-28): every existing spec had only ever run on Desktop Chrome.
  // `android` exercises real Android Chrome geometry/touch on the Chromium engine; `ios` runs on
  // WebKit — the actual Safari engine, the only place the safe-area, 100vh->dvh, iOS 16px-input-
  // zoom, and visualViewport-keyboard fixes in this codebase can be genuinely verified (no iOS
  // Simulator exists on Windows/Linux CI, so this is the closest real coverage available).
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fake camera for the one camera-flow spec in this suite (fakecam.spec.ts): Chromium
        // synthesizes a live stream so getUserMedia resolves without a prompt. Harmless to specs
        // that never call getUserMedia; the multiplayer suite keeps its own config because it
        // needs fake media across TWO contexts plus loopback-only WebRTC (see its header).
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'ios', use: { ...devices['iPhone 14 Pro'] } },
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
