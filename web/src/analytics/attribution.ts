/** Same privacy and attribution boundary for the app and unbundled marketing pages. */
interface AnalyticsContext {
  properties(): Record<string, unknown>;
  sanitize(properties: Record<string, unknown>): Record<string, unknown>;
  trafficType(): 'internal' | 'external';
}
declare global {
  interface Window { quickSignAnalyticsContext?: AnalyticsContext }
}

export function attributionProperties(): Record<string, unknown> {
  return typeof window === 'undefined' ? {} : window.quickSignAnalyticsContext?.properties() ?? {};
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown>): Record<string, unknown> {
  if (typeof window !== 'undefined' && window.quickSignAnalyticsContext) return window.quickSignAnalyticsContext.sanitize(properties);
  // If the static helper fails to load, URL redaction must still hold.
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string' && /url|referrer|referring_domain|href/.test(key)) properties[key] = value.split(/[?#]/)[0];
    else if (value && typeof value === 'object') sanitizeAnalyticsProperties(value as Record<string, unknown>);
  }
  return properties;
}
