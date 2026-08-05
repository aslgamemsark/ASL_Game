/**
 * Env-driven WebRTC ICE (STUN/TURN) configuration — the one place multiplayer's networking knows
 * about servers. The application code must NEVER know which TURN provider is in use: swapping the
 * current free OpenRelay for Metered, Twilio, Cloudflare, or a self-hosted coturn is an
 * environment-variable change only, never a code change. See docs/MULTIPLAYER_RUNBOOK.md.
 *
 * Precedence (first that's set wins for TURN):
 *   1. VITE_TURN_SERVERS  — JSON array of RTCIceServer objects. Preferred: supports multiple
 *                           providers and credential rotation with no code change.
 *                           e.g. [{"urls":"turn:relay.example.com:443","username":"u","credential":"c"}]
 *   2. VITE_TURN_URLS + VITE_TURN_USERNAME + VITE_TURN_CREDENTIAL — single-provider shorthand;
 *      VITE_TURN_URLS may be comma-separated.
 *   3. DEFAULT_TURN — the free OpenRelay tier, so nothing must be configured today ($0). This is
 *      best-effort and rate-limited; replace it via env IF launch analytics (the
 *      `multiplayer_ice_connected` event's used_relay rate) show TURN is actually needed.
 *
 * STUN comes from VITE_STUN_URLS (comma-separated) or DEFAULT_STUN. Credentials are only ever read
 * from the environment — never hardcoded for a real (paid) provider, only the public free tier.
 */

const DEFAULT_STUN: readonly string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

// Free public relay. Public, shared, rate-limited credentials — intentionally the only hardcoded
// TURN, and only as the zero-config fallback. A paid provider's secrets must come from env.
const DEFAULT_TURN: readonly RTCIceServer[] = [
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function csv(raw: string | undefined): string[] {
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function parseStun(): RTCIceServer[] {
  const urls = csv(import.meta.env.VITE_STUN_URLS);
  return (urls.length ? urls : DEFAULT_STUN).map((u) => ({ urls: u }));
}

function parseTurn(): RTCIceServer[] {
  const json = import.meta.env.VITE_TURN_SERVERS as string | undefined;
  if (json) {
    try {
      const arr = JSON.parse(json) as RTCIceServer[];
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {
      // Malformed env JSON must not brick multiplayer — fall through to shorthand/default rather
      // than throwing at module load. (A misconfigured deploy degrades to the free tier, loudly
      // visible in the ICE analytics, instead of crashing every match.)
      if (import.meta.env.DEV) console.warn('[QuickSign] VITE_TURN_SERVERS is not valid JSON — ignoring');
    }
  }
  const urls = csv(import.meta.env.VITE_TURN_URLS);
  if (urls.length > 0) {
    const username = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const credential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    return urls.map((u) => ({ urls: u, username, credential }));
  }
  return [...DEFAULT_TURN];
}

let cached: RTCConfiguration | null = null;

/** The RTCConfiguration to hand every RTCPeerConnection. Computed once (env is fixed at build
 *  time) and reused. STUN-first ordering is preserved so the browser only relays through TURN when
 *  direct/reflexive candidates fail. */
export function getIceServers(): RTCConfiguration {
  if (!cached) {
    cached = { iceServers: [...parseStun(), ...parseTurn()] };
  }
  return cached;
}

/** True when the active TURN config is the built-in free fallback (no env override). Surfaced in
 *  analytics/runbook so "are we still on free TURN?" is answerable without reading the deploy env. */
export function isUsingDefaultTurn(): boolean {
  return !import.meta.env.VITE_TURN_SERVERS && csv(import.meta.env.VITE_TURN_URLS).length === 0;
}
