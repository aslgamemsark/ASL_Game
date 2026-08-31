import { useState } from 'react';
import { track } from '@/analytics';

interface Props {
  /** Where this affordance appears — becomes the `context` analytics property and picks the
   *  default share copy/UTM campaign below. A union of one on purpose (see types.ts's
   *  `share_clicked`): onboarding's first-sign celebration is an equally strong candidate moment
   *  (arguably a bigger audience than reaching a full lesson completion) but it auto-advances
   *  ~1.6s after passing — not enough real time to notice a new button, let alone use it — so
   *  wiring it there needs a UX change to that screen's pacing first, not just adding a context
   *  value here. Left for a deliberate follow-up rather than shipped half-tuned. */
  context: 'first_lesson_complete';
  className?: string;
}

/** Honest, specific copy — no invented user counts, no "revolutionary," nothing the product
 *  doesn't actually do. `utm_source=share`/`utm_medium=referral` so attribution.ts (and every
 *  downstream event) can tell a referred visitor apart from a direct or campaign one. */
const SHARE_CONFIG: Record<Props['context'], { text: string; campaign: string }> = {
  first_lesson_complete: {
    text: 'I just finished my first ASL lesson on QuickSign — it watches through your webcam and tells you exactly what to fix. Free, no signup.',
    campaign: 'first_lesson_share',
  },
};

/** Pure URL-building, exported so it's unit-testable without rendering React or a real
 *  `window.location` — points at `/` (marketing), never `/app`: a share recipient is a cold
 *  visitor who should see the pitch, not land mid-onboarding. */
export function buildShareUrl(origin: string, context: Props['context']): string {
  return `${origin}/?utm_source=share&utm_medium=referral&utm_campaign=${SHARE_CONFIG[context].campaign}`;
}

/**
 * The share loop's smallest useful version (launch-readiness Phase G): `navigator.share` where
 * available (mobile — opens the native share sheet), a copy-to-clipboard fallback everywhere else
 * (desktop browsers largely don't implement the Web Share API). Both paths point at `/`, the
 * marketing page — a share recipient is a cold visitor, not someone who should land mid-onboarding
 * at `/app`.
 *
 * Deliberately NOT a personalized result page (e.g. `/challenge/<id>`) or a multiplayer challenge
 * link — both need real backend state and guests can't use multiplayer at all today (DuelPage.tsx),
 * making that a much larger change than this launch push calls for. This is the version that ships
 * now; a richer share surface is a real candidate for later, not a blocker.
 */
export function ShareButton({ context, className = '' }: Props) {
  const [copied, setCopied] = useState(false);
  const { text } = SHARE_CONFIG[context];

  const handleShare = async () => {
    const url = buildShareUrl(window.location.origin, context);

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'QuickSign', text, url });
        track('share_clicked', { context, method: 'share_sheet' });
      } catch {
        // AbortError (user closed the share sheet) is the overwhelmingly common case here and is
        // not a failure worth logging or falling back from — the user made a real choice not to
        // share. A genuine share-sheet error is rare enough, and inconsequential enough, not to
        // need its own handling.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      track('share_clicked', { context, method: 'clipboard' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked (permissions policy, insecure context) — fail silently rather
      // than surface an error for what is, from the user's perspective, an optional extra.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={`text-sm font-bold px-4 py-2 min-h-11 rounded-xl bg-z-purple/20 text-z-purple-light border border-z-purple/30 hover:bg-z-purple/30 transition-colors ${className}`}
    >
      {copied ? 'Copied! ✓' : 'Share ↗'}
    </button>
  );
}
