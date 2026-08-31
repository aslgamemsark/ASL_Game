/**
 * First-touch and session-touch marketing attribution.
 *
 * Before this module: UTMs were captured only by the marketing pages' one-off `landing_view` event
 * (see public/home.html) and never attached to anything downstream — once a visitor reached the
 * app, which channel brought them was gone. This is the fix: capture whatever UTMs the CURRENT
 * page load carries, persist them same-origin (marketing pages and the app share an origin, so a
 * write on / and a read on /app Just Works with zero cross-page plumbing), and let client.ts
 * register both as PostHog super properties so every event from here on carries them.
 *
 * Two horizons, both useful for different questions:
 *   - First-touch (localStorage, write-once): "which channel originally brought this person here,
 *     ever" — answers acquisition-channel ROI. Never overwritten once set.
 *   - Session-touch (sessionStorage, overwritten on every UTM-bearing load): "which channel drove
 *     THIS visit" — answers "what made them come back today", distinct from first-touch for a
 *     returning visitor who clicked a different link this time.
 *
 * Deliberately independent of `sanitizeAnalyticsProperties` (client.ts): that function redacts
 * `$current_url`/`$referrer`/`$referring_domain` because Supabase returns auth tokens in the URL
 * FRAGMENT, which must never reach PostHog. UTMs live in the query string, are read directly from
 * `location.search` here, and are attached as their own named properties — not through
 * `$current_url` — so nothing here touches or weakens that security control.
 */

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  /** Path the visitor actually landed on (e.g. '/', '/asl-alphabet.html') — lets a channel be
   *  attributed to which marketing surface it drove traffic to, not just that it drove traffic. */
  landing_path: string | null;
}

const FIRST_TOUCH_KEY = 'qs_first_touch';
const SESSION_TOUCH_KEY = 'qs_session_touch';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

function parseFromCurrentLocation(): Attribution | null {
  const params = new URLSearchParams(window.location.search);
  if (!UTM_PARAMS.some((p) => params.has(p))) return null;
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    referrer: document.referrer || null,
    landing_path: window.location.pathname,
  };
}

function readStored(storage: Storage, key: string): Attribution | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null; // private-mode / disabled storage — attribution is best-effort, never fatal.
  }
}

function writeStored(storage: Storage, key: string, value: Attribution): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full — same best-effort posture as the read side above.
  }
}

/**
 * Call once per page load, as early as possible (main.tsx, before initAnalytics so the super
 * properties below are registered from the very first event). A no-op when the current URL carries
 * no UTM — an organic/direct visit neither creates nor clears existing attribution.
 */
export function captureAttribution(): void {
  const current = parseFromCurrentLocation();
  if (!current) return;
  writeStored(sessionStorage, SESSION_TOUCH_KEY, current);
  if (!readStored(localStorage, FIRST_TOUCH_KEY)) {
    writeStored(localStorage, FIRST_TOUCH_KEY, current);
  }
}

export function getFirstTouch(): Attribution | null {
  return readStored(localStorage, FIRST_TOUCH_KEY);
}

export function getSessionTouch(): Attribution | null {
  return readStored(sessionStorage, SESSION_TOUCH_KEY);
}

/** Flattened + prefixed for use as PostHog super/person properties — prefixes keep these from ever
 *  colliding with a real event's own property names (e.g. an event that itself has a `utm_source`). */
export function firstTouchProperties(): Record<string, string | null> {
  const ft = getFirstTouch();
  if (!ft) return {};
  return {
    first_touch_utm_source: ft.utm_source,
    first_touch_utm_medium: ft.utm_medium,
    first_touch_utm_campaign: ft.utm_campaign,
    first_touch_utm_content: ft.utm_content,
    first_touch_utm_term: ft.utm_term,
    first_touch_referrer: ft.referrer,
    first_touch_landing_path: ft.landing_path,
  };
}

export function sessionTouchProperties(): Record<string, string | null> {
  const st = getSessionTouch();
  if (!st) return {};
  return {
    session_utm_source: st.utm_source,
    session_utm_medium: st.utm_medium,
    session_utm_campaign: st.utm_campaign,
    session_utm_content: st.utm_content,
    session_utm_term: st.utm_term,
  };
}
