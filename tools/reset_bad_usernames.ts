/**
 * One-off moderation sweep: find and reset usernames that fail the profanity filter but were
 * grandfathered in before the filter existed (the interactive signup/rename paths block new ones,
 * but nothing ever re-scanned existing rows). Reuses the EXACT same `isInappropriate` filter the
 * app uses — no duplicated blocklist — so it stays in lockstep with the client.
 *
 * Requires the Supabase SERVICE ROLE key (bypasses RLS to read/write every profile). This key must
 * NEVER ship in the web client — run this locally only:
 *
 *   # dry run (default) — prints what WOULD change, writes nothing:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx tools/reset_bad_usernames.ts
 *
 *   # actually apply the resets:
 *   ... npx tsx tools/reset_bad_usernames.ts --apply
 *
 * Offending names are reset to `player_<first 8 hex of the user id>` — deterministic, unique
 * (UUID-derived), and valid under the profiles_username_format CHECK (^[a-zA-Z0-9_]{3,20}$).
 */
import { isInappropriate } from '../web/src/lib/profanity';

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const PAGE = 1000;

if (!BASE || !KEY) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (service-role key only — never commit it)');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

interface Profile { id: string; username: string; }

function placeholderFor(id: string): string {
  return `player_${id.replace(/-/g, '').slice(0, 8)}`;
}

async function fetchAllProfiles(): Promise<Profile[]> {
  const out: Profile[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${BASE}/rest/v1/profiles?select=id,username&order=id.asc&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as Profile[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

async function rename(id: string, newName: string): Promise<void> {
  const url = `${BASE}/rest/v1/profiles?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ username: newName }),
  });
  if (!res.ok) throw new Error(`rename ${id} failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const profiles = await fetchAllProfiles();
  const offenders = profiles.filter((p) => p.username && isInappropriate(p.username));

  console.log(`scanned ${profiles.length} profiles, found ${offenders.length} needing reset\n`);
  for (const p of offenders) {
    console.log(`  ${p.username}  ->  ${placeholderFor(p.id)}   (${p.id})`);
  }

  if (offenders.length === 0) return;
  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to reset these.');
    return;
  }

  console.log('\napplying resets...');
  for (const p of offenders) {
    await rename(p.id, placeholderFor(p.id));
    console.log(`  reset ${p.id}`);
  }
  console.log('done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
