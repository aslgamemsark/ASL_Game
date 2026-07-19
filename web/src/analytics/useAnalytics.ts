import { track, identifyUser, aliasAnon, resetIdentity, setGroup } from './capture';

/**
 * Thin hook wrapper around the module-level capture functions. The functions themselves are
 * already stable (module exports, not closures over component state), so this hook exists for a
 * single reason: it's the idiomatic React entry point other hooks/components reach for, keeping
 * `import { useAnalytics } from '@/analytics'` consistent with the rest of the app's hook-based
 * conventions rather than mixing "import a hook here, a bare function there."
 */
export function useAnalytics() {
  return { track, identifyUser, aliasAnon, resetIdentity, setGroup };
}
