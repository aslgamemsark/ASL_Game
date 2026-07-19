import { getPosthog } from './client';

/**
 * Typed feature-flag keys. Two families, both created in PostHog (see docs/analytics/FUNNELS.md
 * for setup) but used differently:
 *
 *  - Rollout/experiment flags: default OFF, flip ON to gradually expose a new UI/feature.
 *  - Kill switches: default ON (feature enabled), flip OFF to remotely disable a feature that
 *    breaks under real Reddit-launch load without shipping a hotfix. Every kill switch MUST be
 *    checked at its feature's actual entry point (see useFeatureFlag.ts's usage in App.tsx/
 *    relevant pages) with a friendly fallback message — never a blank screen.
 */
export const FEATURE_FLAGS = {
  // Rollout / experiment flags
  framing_gate: 'framing_gate',
  hand_skeleton: 'hand_skeleton',
  new_multiplayer_ui: 'new_multiplayer_ui',
  new_onboarding: 'new_onboarding',
  new_shop: 'new_shop',
  mascot_variant: 'mascot_variant',

  // Emergency kill switches — see KILL_SWITCH_DEFAULT below for each one's safe fallback value.
  disable_camera: 'disable_camera',
  disable_classifier: 'disable_classifier',
  disable_multiplayer: 'disable_multiplayer',
  disable_shop: 'disable_shop',
  disable_review: 'disable_review',
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/** Kill switches are OFF (disabled=false, i.e. feature ENABLED) by default so a PostHog outage or
 *  an unconfigured flag can never accidentally take a feature down — the safe failure mode is
 *  "flag unreadable -> feature stays on", matching normal operation. */
export const KILL_SWITCH_DEFAULT: Record<
  'disable_camera' | 'disable_classifier' | 'disable_multiplayer' | 'disable_shop' | 'disable_review',
  false
> = {
  disable_camera: false,
  disable_classifier: false,
  disable_multiplayer: false,
  disable_shop: false,
  disable_review: false,
};

/**
 * Non-hook kill-switch read, for the few call sites that aren't React components (useCamera.ts,
 * useClassifier.ts's module-level loadOnce) and so can't use useFeatureFlag. Same safe-default
 * contract: unreadable (no key, flags not loaded yet) -> false -> feature stays enabled.
 */
export function isKillSwitchOn(
  key: 'disable_camera' | 'disable_classifier' | 'disable_multiplayer' | 'disable_shop' | 'disable_review'
): boolean {
  const ph = getPosthog();
  if (!ph) return false;
  return ph.isFeatureEnabled(FEATURE_FLAGS[key]) === true;
}
