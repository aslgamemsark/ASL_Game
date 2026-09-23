// Public surface of the analytics module. Import from '@/analytics', not from individual files —
// this keeps the internal split (client/events/types/capture) free to change without touching
// every call site.
export { initAnalytics, analyticsConfigured } from './client';
export { track, newAnalyticsId, identifyUser, resetIdentity, isAnalyticsOptedOut, setAnalyticsOptOut } from './capture';
export { trackFirstSignSuccess } from './firstSuccess';
export { useScreenView } from './useScreenView';
export { useFeatureFlag } from './useFeatureFlag';
export { FEATURE_FLAGS, KILL_SWITCH_DEFAULT, isKillSwitchOn, type FeatureFlagKey } from './featureFlags';
export { EVENTS } from './events';
export type { EventPayloads, ActiveEventName, ScreenName, SignAttemptBase, MultiplayerBase } from './types';
