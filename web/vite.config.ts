import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
        globIgnores: ['**/clips/**', '**/models/**', '**/reference_poses/**', '**/dev/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Never route cross-origin/API or direct asset requests through the SPA fallback.
        navigateFallbackDenylist: [/^\/api\//, /\/[^/?]+\.[^/?]+$/],
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
        start_url: '/',
        scope: '/',
        categories: ['education', 'games'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
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
        },
      },
    },
  },
})
