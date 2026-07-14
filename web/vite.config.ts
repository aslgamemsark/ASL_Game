import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
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
})
