import { Zippy } from '@/components/shared/Zippy';

/**
 * Full-page centered loading state: the Zippy mascot plus "Loading…". Was hand-written twice,
 * identically, in `App.tsx` — the auth-restore gate every returning user sees on cold start, and
 * the lazy-route fallback every code-split navigation sees — by design the same visual language so
 * neither reads as a different app state, but duplicated as markup rather than as an intent.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-z-bg flex items-center justify-center overflow-y-auto">
      <div className="text-center">
        <Zippy expression="loading" size="lg" priority className="mb-4" />
        <p className="text-z-gray-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}
