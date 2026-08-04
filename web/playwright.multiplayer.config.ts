import { defineConfig, devices } from '@playwright/test';

/**
 * Multiplayer integration suite — separate from playwright.config.ts on purpose.
 *
 * Three things make it a different kind of run from the main suite:
 *
 *  1. It needs a LOCAL Supabase stack. The app under test is built against 127.0.0.1 via the
 *     webServer env below, so no automated run can touch the hosted production project. This is
 *     build-time configuration only — no production source file knows this suite exists, and
 *     there is no test-only auth path: the browser tests sign in through the real form against
 *     real GoTrue with fixture accounts on the local stack.
 *  2. It needs fake media devices. Duel opens a camera on both sides; without the fake device
 *     flags every run would block on a permission prompt that never gets answered.
 *  3. It is Chromium-only. WebRTC between two contexts with a synthetic camera is reliable on
 *     Chromium; WebKit's fake-capture support does not cover the same ground, and a
 *     cross-engine matrix here would test Playwright's media shims rather than this app. Mobile
 *     behaviour is covered by an emulated phone viewport inside the suite instead — see the
 *     "usable at phone width" test. This is a real coverage limit, recorded in
 *     docs/KNOWN_LIMITATIONS.md rather than papered over.
 *
 * Run with `npm run test:multiplayer`. Skips cleanly (with an explanatory message) when the local
 * stack is not running — see docs/MULTIPLAYER_TESTING.md.
 */

const STACK_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const STACK_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default defineConfig({
  testDir: './e2e',
  testMatch: /multiplayer\.spec\.ts/,
  // Serial. Every test truncates the shared room registry and the per-user join throttle counters
  // between cases; parallel workers would delete each other's fixtures mid-test and fail in a way
  // that looks like a product race condition rather than a test-isolation bug.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  // Two browser contexts, a real WebRTC handshake and a signed-in auth round trip per client —
  // several times the work of a single-page test in the main suite.
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
    permissions: ['camera', 'microphone'],
  },
  projects: [
    {
      name: 'multiplayer-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Synthetic camera/mic: getUserMedia resolves with a generated stream instead of
            // prompting, so both peers have real tracks to negotiate over.
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            // Loopback-only ICE keeps the handshake off the public STUN/TURN servers the app
            // configures for production — a test must not depend on a third party being up.
            '--force-webrtc-ip-handling-policy=default_public_interface_only',
          ],
        },
      },
    },
  ],
  webServer: {
    // Port 4174, not the main suite's 4173, so both suites can run at once without one serving
    // the other's build — this build points at the local Supabase stack and must never be reused
    // by the production-config suite.
    command: 'npm run build && npm run preview -- --port 4174',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: STACK_URL,
      VITE_SUPABASE_ANON_KEY: STACK_ANON_KEY,
      // Same reasoning as the main config: never send test traffic to the real PostHog project.
      VITE_POSTHOG_KEY: '',
    },
  },
});
