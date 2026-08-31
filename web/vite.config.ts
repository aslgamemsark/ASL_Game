import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { rm } from 'fs/promises'

// Vite copies `public/` into `dist/` verbatim with no exclusion mechanism of its own, so these
// dev-tool-only assets (avatar rig authoring: src/avatar/tools/**, dead-code-eliminated from every
// production code path — see App.tsx's /avatarlab guard) were being deployed to production for no
// reason: ~8MB of GLBs + pose metadata that nothing but a local CLI script ever reads. Already
// excluded from the PWA's precache manifest (vite.config.ts's globIgnores below), but that only
// stops the service worker from *prefetching* them — they were still sitting on the deploy,
// reachable by direct URL. Deleting them post-build (not from `public/` itself) keeps them
// available for local dev tooling, which reads/writes this same `public/` directory directly via
// `vite dev`'s static serving — only the production deploy artifact loses them.
function stripDevOnlyPublicAssets(): Plugin {
  return {
    name: 'strip-dev-only-public-assets',
    apply: 'build',
    async writeBundle() {
      await Promise.all([
        rm(path.resolve(__dirname, 'dist/reference_poses'), { recursive: true, force: true }),
        rm(path.resolve(__dirname, 'dist/models/avatar'), { recursive: true, force: true }),
        // Landmark fixtures for the Avatar Lab's LandmarkViewer. That whole page is behind
        // `import.meta.env.DEV`, so nothing in a production build can fetch these.
        rm(path.resolve(__dirname, 'dist/dev'), { recursive: true, force: true }),
        // The trained sign classifier's weights. CLASSIFIER_LOAD_ENABLED is false
        // (src/config/classifier.ts), so no production code path requests them — they were 421 kB
        // of deploy artifact that could never be fetched. RE-ENABLING THE CLASSIFIER MEANS
        // REMOVING THIS LINE as well as flipping that flag, or the model 404s. That is not the
        // trap it looks like: re-enabling already requires retraining first (the shipped model_v4
        // is out-of-distribution and was rejecting correct signs — see the flag's own comment), so
        // new weights have to be deployed regardless.
        rm(path.resolve(__dirname, 'dist/models/signs'), { recursive: true, force: true }),
      ]);
    },
  };
}

// Release metadata for the analytics module (web/src/analytics/client.ts registers these as
// PostHog session super properties, once per session, not threaded into every event manually).
// Vercel sets VERCEL_GIT_COMMIT_SHA/VERCEL_ENV in its build environment; local dev falls back to
// harmless placeholders since a developer machine has neither. See analytics/buildInfo.d.ts for
// the corresponding ambient type declarations.
const APP_VERSION = process.env.npm_package_version ?? '0.0.0';
const GIT_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';
const DEPLOY_ENV = process.env.VERCEL_ENV ?? 'development';
const BUILD_TIMESTAMP = new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __GIT_COMMIT__: JSON.stringify(GIT_COMMIT),
    __DEPLOY_ENV__: JSON.stringify(DEPLOY_ENV),
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'autoUpdate', not 'prompt' (changed 2026-07-29). Under 'prompt' the update is opt-in: the
      // app showed a "A new version is ready / Refresh / Later" toast, and anyone who tapped Later
      // or never saw it kept running their cached build forever. Measured on production traffic:
      // 13 of 17 real users were still executing the 2026-07-24 bundle days after the S1 activation
      // fixes shipped — including the AI-veto shadow-mode fix, so those users were still being
      // rejected on correct signs by a gate that had already been turned off in the code.
      // Shipping a fix nobody receives is the same as not shipping it.
      //
      // The forced `window.location.reload()` this normally implies is intercepted in
      // InstallPrompt.tsx via `onNeedReload` — see lib/cameraActivity.ts for why a reload must
      // never land mid-lesson.
      registerType: 'autoUpdate',
      // Precache only the app shell (JS/CSS/HTML + icons). The heavy assets — sign demo clips
      // (~2.3MB), the MediaPipe/classifier models (~2.6MB), and reference poses — are runtime-
      // cached on first use instead, so installing the app doesn't force a multi-MB download.
      //
      // That principle was being silently violated for two JS CHUNKS, found 2026-07-30:
      // `globPatterns` globs the whole `dist/assets` output, so every `React.lazy()` route chunk —
      // including `vendor-tfjs` (~1.08MB) and `AnalyticsTab`/recharts (~393KB, admin-only) — was
      // being eagerly precached by the service worker for every installed user on every update,
      // completely undoing App.tsx's own route-level code-splitting (its comment there explains
      // route-splitting was added specifically so a first-time visitor wouldn't download all ~2MB
      // of app JS before picking a lesson — precache was quietly re-downloading all of it anyway,
      // just moved from "on first paint" to "in the background right after install"). vendor-tfjs
      // is additionally now DEAD WEIGHT: CLASSIFIER_LOAD_ENABLED (config/classifier.ts) means the
      // dynamic import that would fetch it is never reached at runtime at all — precaching it was
      // pure waste. The other, smaller per-route page chunks (10-50KB) are deliberately still
      // precached: they support the lesson/practice/story loop working offline, which is real,
      // intentional behavior this project relies on (see KNOWN_LIMITATIONS.md).
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
        globIgnores: [
          '**/clips/**', '**/models/**', '**/reference_poses/**', '**/dev/**',
          '**/vendor-tfjs-*.js', '**/AnalyticsTab-*.js',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Never route cross-origin/API or direct asset requests through the SPA fallback.
        // `/^\/$/` is new (2026-08-31): `/` now serves the static marketing page (home.html via
        // vercel.json's rewrite), not the SPA. Without this, an already-installed PWA's cached
        // service worker would keep intercepting `/` navigations and serving the OLD precached
        // index.html instead of letting the request reach the marketing page — the exact
        // "installed clients strand on the app shell at /" failure mode called out when this
        // migration was planned.
        navigateFallbackDenylist: [/^\/api\//, /^\/$/, /\/[^/?]+\.[^/?]+$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/clips/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'signup-clips',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/models/') || url.pathname.startsWith('/reference_poses/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'signup-models',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // MediaPipe's WASM runtime (jsdelivr) and hand/pose/face `.task` model weights
            // (storage.googleapis.com) sit on the camera critical path on EVERY lesson/practice/
            // story/speed/duel/room visit, but were covered by no runtimeCaching rule at all
            // (found 2026-07-30) — the rule above only matches same-origin `/models/` and
            // `/reference_poses/` paths, never these absolute cross-origin URLs. Without this,
            // the SW leaves them to the browser's plain HTTP cache, which a private/incognito
            // session or a cleared cache empties — re-fetching several MB from Google/jsdelivr
            // every time that happens instead of once per app version.
            urlPattern: ({ url }) =>
              url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'storage.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'signup-mediapipe-cdn',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Enabled in dev too so the manifest + registration can be verified without a prod build.
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['favicon.png', 'favicon-16x16.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'QuickSign — Learn ASL with Zippy',
        short_name: 'QuickSign',
        description: 'Learn American Sign Language through play — camera-based practice, lessons, and 1v1 challenges.',
        lang: 'en',
        theme_color: '#120B1E',
        background_color: '#0D0A1E',
        display: 'standalone',
        orientation: 'portrait',
        // `id` defaults to `start_url` per the Web App Manifest spec, and is what Chrome uses to
        // decide whether this manifest is an update to an existing install or a brand-new app.
        // Pinned explicitly to the OLD start_url so changing start_url below does not strand every
        // already-installed user as an orphaned "new" install with no icon/history continuity.
        id: '/',
        start_url: '/app',
        scope: '/app',
        categories: ['education', 'games'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
    stripDevOnlyPublicAssets(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // tfjs is only reached via a lazy dynamic import in engine/classifier.ts, which Vite's dep
  // scanner doesn't always pre-bundle — list it so the dev server can serve the optimized dep
  // on demand (prod build already code-splits it correctly).
  optimizeDeps: {
    include: ['@tensorflow/tfjs'],
  },
  build: {
    rollupOptions: {
      output: {
        // These are the largest vendor deps and change far less often than app code — splitting
        // them into their own chunks lets the browser cache them across app deploys instead of
        // re-downloading them on every release.
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/@tensorflow')) return 'vendor-tfjs';
          if (id.includes('node_modules/@mediapipe')) return 'vendor-mediapipe';
          // Named explicitly so it doesn't fall back to rolldown's generic `module-*` chunk name —
          // posthog-js is dynamically imported (client.ts) specifically so it's NOT part of this
          // list of eagerly-modulepreloaded chunks; naming it doesn't change that, just makes the
          // build output legible.
          if (id.includes('node_modules/posthog-js')) return 'vendor-posthog';
        },
      },
    },
  },
})
