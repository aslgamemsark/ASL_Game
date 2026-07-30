import { useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useUserStore } from '@/stores/useUserStore';
import { getSnapshot, isReturningVisitor, promptInstall, subscribe } from '@/lib/pwaInstall';
import { runWhenCameraIdle } from '@/lib/cameraActivity';

const DISMISS_KEY = 'signup-install-dismissed';

export function InstallPrompt() {
  // Service worker updates apply on their own now (vite.config.ts `registerType: 'autoUpdate'`),
  // so there is no "new version ready" toast to show and no opt-in for the user to decline — the
  // opt-in was what stranded most of the user base on a stale bundle. All this hook still does is
  // take over the reload the plugin would otherwise fire the instant the new worker activates.
  useRegisterSW({
    onNeedReload() {
      // Never mid-lesson: a reload here would kill the learner's camera stream and their
      // in-progress attempt. Deferred to the next moment no camera session is running.
      runWhenCameraIdle(() => window.location.reload());
    },
  });
  const { canInstall, isIosHint, installed } = useSyncExternalStore(subscribe, getSnapshot);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = () => {
    void promptInstall('banner').then(() => localStorage.setItem(DISMISS_KEY, '1'));
  };

  // Shown on app open for RETURNING visitors only (2026-07-28 rework). `beforeinstallprompt` fires
  // on first load, so an ungated banner used to appear on the welcome screen — at `bottom-24` it
  // covered the tagline and overlapped the "Get Started" CTA, on the exact screen where half of
  // all users already leave (verified in Chrome against the production build, 2026-07-27). Gating
  // on "not this browser's first session" keeps the banner off onboarding and the welcome screen
  // entirely, without requiring a completed lesson — install is now also reachable any time from
  // Settings, so the open-app banner no longer needs to be the only path to it.
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  const showAtOpen = onboardingComplete && isReturningVisitor() && !installed;
  const showInstall = showAtOpen && !dismissed && canInstall;
  const showIos = showAtOpen && !dismissed && isIosHint;

  return (
    <>
      {/* Install banner (Android / Chrome / Edge / desktop) */}
      <AnimatePresence>
        {showInstall && (
          <motion.div
            className="fixed bottom-[calc(6rem+var(--sab))] left-1/2 -translate-x-1/2 z-elevated w-[min(92vw,26rem)] flex items-center gap-3 bg-z-card border border-white/10 rounded-2xl px-4 py-3 shadow-2xl shadow-z-purple/20"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          >
            <img src="/pwa-192x192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Install QuickSign</p>
              <p className="text-[11px] text-z-gray-400">Add it to your home screen for the full app.</p>
            </div>
            <button
              onClick={install}
              className="text-xs font-bold bg-z-purple text-white rounded-xl px-3.5 min-h-11 shrink-0"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="w-11 h-11 flex items-center justify-center text-z-gray-400 hover:text-z-gray-50 text-lg leading-none shrink-0 -mr-2"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari manual-install hint */}
      <AnimatePresence>
        {showIos && (
          <motion.div
            className="fixed bottom-[calc(6rem+var(--sab))] left-1/2 -translate-x-1/2 z-elevated w-[min(92vw,26rem)] flex items-center gap-3 bg-z-card border border-white/10 rounded-2xl px-4 py-3 shadow-2xl shadow-z-purple/20"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
          >
            <img src="/pwa-192x192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Install QuickSign</p>
              <p className="text-[11px] text-z-gray-400">
                Tap <span className="inline-block align-middle">⬆️</span> Share, then “Add to Home Screen”.
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="w-11 h-11 flex items-center justify-center text-z-gray-400 hover:text-z-gray-50 text-lg leading-none shrink-0 -mr-2"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
