import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';

// The browser fires `beforeinstallprompt` (Chrome / Edge / Android) when the PWA is installable.
// We stash the event and trigger it from our own button so the install offer matches the app's UI
// instead of the browser's default mini-infobar. iOS Safari has no such event — it installs via
// Share → Add to Home Screen — so we show a short hint there instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'signup-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag when launched from the home screen.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallPrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to offer

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS never fires beforeinstallprompt; surface the manual instructions once instead.
    if (isIos() && !dismissed) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [dismissed]);

  const dismiss = () => {
    setDismissed(true);
    setDeferred(null);
    setShowIosHint(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const showInstall = !dismissed && !!deferred;
  const showIos = !dismissed && showIosHint;

  return (
    <>
      {/* Update-available toast (registerType: 'prompt') */}
      <AnimatePresence>
        {needRefresh && (
          <motion.div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-z-card border border-z-purple/40 rounded-2xl px-4 py-3 shadow-2xl shadow-z-purple/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span className="text-sm font-semibold">A new version is ready</span>
            <button
              onClick={() => updateServiceWorker(true)}
              className="text-xs font-bold bg-z-purple text-white rounded-xl px-3 py-1.5"
            >
              Refresh
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="text-xs text-z-gray-400 hover:text-white"
              aria-label="Dismiss"
            >
              Later
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install banner (Android / Chrome / Edge / desktop) */}
      <AnimatePresence>
        {showInstall && (
          <motion.div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,26rem)] flex items-center gap-3 bg-z-card border border-white/10 rounded-2xl px-4 py-3 shadow-2xl shadow-z-purple/20"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          >
            <img src="/pwa-192x192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Install SignUp</p>
              <p className="text-[11px] text-z-gray-400">Add it to your home screen for the full app.</p>
            </div>
            <button
              onClick={install}
              className="text-xs font-bold bg-z-purple text-white rounded-xl px-3.5 py-2 shrink-0"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-z-gray-500 hover:text-white text-lg leading-none shrink-0"
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
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,26rem)] flex items-center gap-3 bg-z-card border border-white/10 rounded-2xl px-4 py-3 shadow-2xl shadow-z-purple/20"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
          >
            <img src="/pwa-192x192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Install SignUp</p>
              <p className="text-[11px] text-z-gray-400">
                Tap <span className="inline-block align-middle">⬆️</span> Share, then “Add to Home Screen”.
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-z-gray-500 hover:text-white text-lg leading-none shrink-0"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
