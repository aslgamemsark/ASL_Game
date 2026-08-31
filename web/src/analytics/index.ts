// Public surface of the analytics module. Import from '@/analytics', not from individual files —
// this keeps the internal split (client/events/types/capture) free to change without touching
// every call site.
export { initAnalytics, analyticsConfigured } from './client';
export { track, identifyUser, aliasAnon, resetIdentity, setGroup, isAnalyticsOptedOut, setAnalyticsOptOut } from './capture';
export { trackFirstSignSuccess } from './firstSuccess';
export { useAnalytics } from './useAnalytics';
export { useScreenView } from './useScreenView';
export { useFeatureFlag } from './useFeatureFlag';
export { FEATURE_FLAGS, KILL_SWITCH_DEFAULT, isKillSwitchOn, type FeatureFlagKey } from './featureFlags';
export { EVENTS, FUTURE_EVENTS } from './events';
export { captureAttribution, getFirstTouch, getSessionTouch, firstTouchProperties, sessionTouchProperties } from './attribution';
export type { Attribution } from './attribution';
export type { EventPayloads, ActiveEventName, ScreenName, SignAttemptBase, MultiplayerBase } from './types';
