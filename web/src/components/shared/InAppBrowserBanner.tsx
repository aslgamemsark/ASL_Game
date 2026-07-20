import { useState } from 'react';
import { detectInAppBrowser } from '@/lib/inAppBrowser';

/**
 * A friendly, dismissible banner shown only when the visitor is inside an in-app browser (Reddit,
 * Instagram, etc.) where the camera QuickSign depends on is often blocked. It never blocks the app —
 * it nudges the user to open in their real browser, offers a one-tap "Copy link", and always lets
 * them continue anyway. See lib/inAppBrowser.ts for the detection rationale.
 *
 * Placed at the top of the landing page (the first screen every Reddit visitor sees) so the nudge
 * lands before they invest time and hit the camera wall deeper in a lesson.
 */
export function InAppBrowserBanner() {
  // Detect once on mount — UA/mediaDevices don't change within a page load. `dismissed` starts from
  // the detection so the banner simply never renders in a normal browser (the common case).
  const [info] = useState(() => detectInAppBrowser());
  const [dismissed, setDismissed] = useState(!info.isInApp);
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  const copyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    // Prefer the async Clipboard API; fall back silently — the URL is also shown for manual copy.
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => { /* clipboard blocked in this webview — the visible instruction still applies */ },
    );
  };

  const where = info.appName ? `${info.appName}'s in-app browser` : 'this in-app browser';

  return (
    <div
      role="region"
      aria-label="Open in your browser for the best experience"
      className="relative z-40 border-b border-z-purple-deep/40 bg-z-purple-deep/20 px-4 py-3 text-center"
    >
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-bold text-white">
          👋 For the camera to work, open QuickSign in your browser
        </p>
        <p className="mt-1 text-xs text-z-gray-300">
          QuickSign reads your signs with your camera, and {where} can block camera access. Tap the
          <span className="font-semibold text-white"> ••• </span>
          menu and choose <span className="font-semibold text-white">"Open in browser"</span> (Chrome or Safari).
        </p>
        <div className="mt-2.5 flex items-center justify-center gap-2">
          <button
            onClick={copyLink}
            className="rounded-lg bg-z-purple px-3 py-1.5 text-xs font-bold text-white hover:bg-z-purple-light transition-colors"
          >
            {copied ? 'Link copied ✓' : 'Copy link'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-z-gray-300 hover:bg-white/10 transition-colors"
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
