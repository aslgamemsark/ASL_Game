// Injected at build time via vite.config.ts's `define` block (from Vercel's env vars in prod,
// sensible local fallbacks in dev) — see analytics/client.ts for where these are registered as
// PostHog session super properties. Declared here so TypeScript recognizes the globals; the
// actual string values only exist after Vite's build-time substitution, never at type-check time.
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __DEPLOY_ENV__: string;
declare const __BUILD_TIMESTAMP__: string;
