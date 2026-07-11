// Best-effort IP geolocation to auto-populate a user's region for the region
// leaderboard. Keyless, no account/SDK needed (ipwho.is is free and CORS-open
// for browser calls). Never blocks anything: a failed or slow lookup just
// leaves the profile's region unset, same as if this ran and found nothing.
export async function detectCountryCode(): Promise<string | null> {
  try {
    const res = await fetch('https://ipwho.is/?fields=success,country_code', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; country_code?: string };
    if (!data.success || !data.country_code) return null;
    return data.country_code;
  } catch {
    return null;
  }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
