// Best-effort IP geolocation to auto-populate a user's region for the region leaderboard. Keyless,
// no account/SDK needed. Never blocks anything: a failed or slow lookup just leaves the profile's
// region unset — and the region tab now offers a manual country picker as a guaranteed fallback,
// so a user whose IP lookup is blocked (ad-blockers frequently block these hosts) is never stuck.

interface Provider {
  url: string;
  extract: (json: unknown) => string | null;
}

// Two independent keyless, CORS-open providers. If the first is blocked/rate-limited/down, the
// second is tried before giving up — a single failing provider used to leave region null forever.
const PROVIDERS: Provider[] = [
  {
    url: 'https://ipwho.is/?fields=success,country_code',
    extract: (j) => {
      const d = j as { success?: boolean; country_code?: string };
      return d.success && d.country_code ? d.country_code : null;
    },
  },
  {
    url: 'https://ipapi.co/json/',
    extract: (j) => {
      const d = j as { country_code?: string };
      return d.country_code ?? null;
    },
  },
];

export async function detectCountryCode(): Promise<string | null> {
  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(provider.url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const code = provider.extract(await res.json());
      if (code) return code.toUpperCase();
    } catch {
      // try the next provider
    }
  }
  return null;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// Curated ISO 3166-1 alpha-2 codes for the manual region picker. Covers the populous/likely
// countries; labels are resolved at render via countryName() and sorted alphabetically there.
export const COUNTRY_CODES: readonly string[] = [
  'AE', 'AR', 'AT', 'AU', 'BD', 'BE', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'CZ', 'DE', 'DK', 'EG',
  'ES', 'ET', 'FI', 'FR', 'GB', 'GR', 'HK', 'HU', 'ID', 'IE', 'IL', 'IN', 'IQ', 'IR', 'IT', 'JP',
  'KE', 'KR', 'LK', 'MA', 'MX', 'MY', 'NG', 'NL', 'NO', 'NP', 'NZ', 'PE', 'PH', 'PK', 'PL', 'PT',
  'RO', 'RS', 'RU', 'SA', 'SE', 'SG', 'TH', 'TR', 'TW', 'UA', 'US', 'VN', 'ZA',
];
