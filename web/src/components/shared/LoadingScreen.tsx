import { SigningHand } from '@/components/shared/SigningHand';

/**
 * Full-page centered loading state: Zippy's hand signing 🤟 → 👋 → ✌️ on a loop, plus "Loading…".
 * Was hand-written twice, identically, in `App.tsx` — the auth-restore gate every returning user
 * sees on cold start, and the lazy-route fallback every code-split navigation sees — by design the
 * same visual language so neither reads as a different app state, but duplicated as markup rather
 * than as an intent.
 *
 * The static `Zippy expression="loading"` image here became the animated hand (see SigningHand):
 * this is the one screen users stare at with nothing else to do, and on an ASL app the wait is a
 * better fit for actual signing than for a mascot holding still. It is vector, so it costs no
 * additional image request on the cold start it appears during.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-z-bg flex items-center justify-center overflow-y-auto">
      <div className="text-center">
        <SigningHand size={148} className="mb-4" />
        <p className="text-z-gray-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}
