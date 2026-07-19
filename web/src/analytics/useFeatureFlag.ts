import { useEffect, useState } from 'react';
import { getPosthog } from './client';
import type { FeatureFlagKey } from './featureFlags';
import { FEATURE_FLAGS } from './featureFlags';

/**
 * Read a PostHog feature flag with a safe default. If analytics isn't configured, PostHog hasn't
 * loaded flags yet, or the flag doesn't exist in the project, `defaultValue` wins — a flag outage
 * can never break the UI. Subscribes to PostHog's onFeatureFlags callback so the value updates
 * once flags finish loading (they arrive async after init).
 */
export function useFeatureFlag(flag: FeatureFlagKey, defaultValue: boolean): boolean {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const ph = getPosthog();
    if (!ph) return;

    const read = () => {
      const result = ph.isFeatureEnabled(FEATURE_FLAGS[flag]);
      setValue(typeof result === 'boolean' ? result : defaultValue);
    };
    read();
    return ph.onFeatureFlags(read);
    // defaultValue intentionally excluded — a caller passing a new default object/literal each
    // render must not re-subscribe; the flag key is the only thing that should restart this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);

  return value;
}
