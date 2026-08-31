import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import './index.css';
import App from './App';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { installGlobalErrorReporting, checkUnexpectedReload } from '@/lib/errorReporting';
import { initAnalytics } from '@/analytics';
import { captureAttribution } from '@/analytics/attribution';
import { AnalyticsIdentityBridge } from '@/analytics/AnalyticsIdentityBridge';

installGlobalErrorReporting();
// Synchronous and before initAnalytics: captures this load's UTMs (if any) into first-touch and
// session-touch storage so they exist before client.ts's `loaded` callback reads them to register
// PostHog super properties. Also covers a visitor arriving at /app directly with UTMs still on the
// URL (e.g. a deep-linked CTA), not just ones who passed through a marketing page first.
captureAttribution();
// initAnalytics is async (dynamically imports posthog-js so the initial render below isn't stuck
// behind fetching it — see client.ts). Not awaited: checkUnexpectedReload's track() call is
// queue-safe now (whenAnalyticsReady in client.ts), and any load failure is still visible instead
// of silently vanishing (see .claude/rules/concurrency/fire-and-forget-tasks.md).
void initAnalytics().catch((e) => console.error('[QuickSign] analytics failed to load:', e));
checkUnexpectedReload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          {/* No UI — keeps PostHog identity in sync with auth state. Inside AuthProvider so it can
              read useAuth(); see AnalyticsIdentityBridge.tsx for the anon->identified alias flow. */}
          <AnalyticsIdentityBridge />
          {/* reducedMotion="user": every framer-motion animation in the app honors the OS-level
              prefers-reduced-motion setting (transforms/layout animations are skipped, opacity fades
              are kept) — the accessibility gap flagged in PRODUCT.md, fixed once globally. */}
          <MotionConfig reducedMotion="user">
            <App />
            {/* Home-screen install offer + "new version" refresh toast (PWA). */}
            <InstallPrompt />
          </MotionConfig>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
