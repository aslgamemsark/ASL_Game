/**
 * Durable, explicit "is this a friends/family test account" flag — replaces informally treating
 * Pakistan-geolocated traffic as test traffic when filtering PostHog data by hand (see
 * config/classifier.ts's GATE_ENFORCED comment, criterion 2: "excluding Pakistan traffic
 * (friends/family test accounts, not the real US/CA market)"). That convention only ever lived in
 * a code comment — nobody's actual session carried a queryable signal, so every analysis had to
 * remember and re-apply the geography guess by hand, and it silently misclassifies a real
 * Pakistan-based user as a tester (and a tester traveling abroad as real traffic).
 *
 * Opt-in only: nobody is 'internal' by default, so this can't introduce the same bias it replaces.
 * Visit the app once with ?internal=1 (share this link with testers) and it persists on that
 * device from then on — mirrors config/classifier.ts's isClassifierDebugEnabled's ?debug=1 pattern.
 */
const INTERNAL_KEY = 'quicksign_internal_tester';

export function isInternalTraffic(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('internal') === '1') {
      window.localStorage.setItem(INTERNAL_KEY, '1');
      return true;
    }
    return window.localStorage.getItem(INTERNAL_KEY) === '1';
  } catch {
    return false;
  }
}

/** Registered as a PostHog super property (see analytics/client.ts) so every event this device
 *  ever sends carries it — filter with `properties.traffic_type != 'internal'` instead of a
 *  geography guess. */
export function trafficType(): 'internal' | 'external' {
  return isInternalTraffic() ? 'internal' : 'external';
}
