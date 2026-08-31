import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

/**
 * Connection details and fixtures for the LOCAL Supabase stack the multiplayer integration suite
 * runs against (`supabase start`, see supabase/config.toml and docs/MULTIPLAYER_TESTING.md).
 *
 * No automated test is ever pointed at the hosted production project: the values below default to
 * 127.0.0.1 and the CLI's fixed demo keys, and the suite refuses to run against anything whose URL
 * is not local unless E2E_ALLOW_REMOTE_SUPABASE is explicitly set (see assertLocalOnly).
 *
 * The keys here are NOT secrets. `supabase start` issues the same demo JWTs on every machine —
 * they are published in Supabase's own documentation and are signed with a fixed demo secret that
 * only the local stack accepts. A newer CLI that issues different keys is handled by the env
 * overrides: run `npx supabase status -o env` and export the two values.
 */

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:54321';

// Supabase CLI's published demo keys — identical on every local stack, valid nowhere else.
const DEFAULT_LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DEFAULT_LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const STACK_URL = process.env.E2E_SUPABASE_URL ?? DEFAULT_LOCAL_URL;
export const STACK_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? DEFAULT_LOCAL_ANON_KEY;
export const STACK_SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? DEFAULT_LOCAL_SERVICE_KEY;

/**
 * Hard guard against an automated run ever mutating the production project.
 *
 * The suite creates users, rooms and members, and truncates them between tests — harmless against a
 * throwaway local stack, destructive against production. A misconfigured env var is the one
 * plausible way that could happen, so the check is on the URL itself rather than on anyone
 * remembering. Throws rather than skips: a suite silently not running is how the CI hole this
 * whole pass fixed got there in the first place.
 */
export function assertLocalOnly(): void {
  const host = new URL(STACK_URL).hostname;
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
  if (!isLocal && !process.env.E2E_ALLOW_REMOTE_SUPABASE) {
    throw new Error(
      `Refusing to run the multiplayer integration suite against a non-local Supabase host (${host}). ` +
      'This suite creates and deletes rows. Point E2E_SUPABASE_URL at a local `supabase start` stack, ' +
      'or set E2E_ALLOW_REMOTE_SUPABASE=1 if you are certain the target is a disposable test project.'
    );
  }
}

export interface StackProbe {
  reachable: boolean;
  /** Set when the stack answered but rejected our keys — a misconfiguration, not an absent stack. */
  misconfigured?: string;
}

/**
 * Distinguishes "no local stack running" (expected on a machine without Docker — the suite skips)
 * from "stack is up but our keys/schema are wrong" (a real problem — the suite must fail loudly
 * rather than skip, or a broken setup would look identical to a green run).
 */
export async function probeStack(): Promise<StackProbe> {
  let response: Response;
  try {
    response = await fetch(`${STACK_URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(3_000),
      headers: { apikey: STACK_ANON_KEY },
    });
  } catch {
    return { reachable: false };
  }
  if (!response.ok) {
    return { reachable: true, misconfigured: `auth health check returned ${response.status}` };
  }

  // The stack answers; now confirm the schema this suite depends on is actually migrated, so a
  // stack started without `supabase db reset` fails with a useful message instead of a confusing
  // "relation does not exist" mid-test.
  const admin = createAdminClient();
  const { error } = await admin.from('multiplayer_rooms').select('id').limit(1);
  if (error) {
    return {
      reachable: true,
      misconfigured:
        `multiplayer_rooms is not queryable (${error.message}). ` +
        'Run `npx supabase db reset` to apply supabase/migrations to the local stack.',
    };
  }
  return { reachable: true };
}

export function createAdminClient(): SupabaseClient {
  return createClient(STACK_URL, STACK_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(): SupabaseClient {
  return createClient(STACK_URL, STACK_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  email: string;
  password: string;
  id: string;
}

// Deterministic fixtures. Distinct users matter beyond realism: join_multiplayer_room throttles at
// 10 attempts per user per minute (migration 20260718010000), so a suite that shared one account
// across every join would start failing partway through with 'too many join attempts' and look
// like a product bug.
const TEST_PASSWORD = 'quicksign-local-e2e-pw';
const TEST_EMAILS = [
  'mp-host@quicksign.test',
  'mp-guest@quicksign.test',
  'mp-third@quicksign.test',
  'mp-fourth@quicksign.test',
] as const;

/**
 * Creates the fixture accounts on the local stack, pre-confirmed, and returns them.
 *
 * Uses the admin API rather than hand-written INSERTs into auth.users: GoTrue's internal schema
 * changes between versions (the identities table alone has gained required columns twice), and a
 * seed that hand-crafts those rows breaks silently on a CLI upgrade with an unhelpful login error.
 * Idempotent — safe to call from every worker.
 */
export async function ensureTestUsers(): Promise<TestUser[]> {
  const admin = createAdminClient();
  const users: TestUser[] = [];

  for (const email of TEST_EMAILS) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (data?.user) {
      users.push({ email, password: TEST_PASSWORD, id: data.user.id });
      continue;
    }

    // Already provisioned by an earlier run/worker — look the id up instead of failing.
    const existing = await findUserByEmail(admin, email);
    if (!existing) {
      throw new Error(`Could not create or find test user ${email}: ${error?.message ?? 'unknown error'}`);
    }
    users.push({ email, password: TEST_PASSWORD, id: existing });
  }

  return users;
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  // listUsers is paginated; the fixture set is tiny and always on the first page.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users.find((u) => u.email === email)?.id ?? null;
}

/**
 * Removes every room this suite created, plus the per-user join throttle counters.
 *
 * The throttle reset is the load-bearing part: at 10 join attempts per user per minute, a full
 * suite run would otherwise poison later tests with 'too many join attempts' depending only on how
 * fast the machine got through the earlier ones — a failure that reads as a product bug and
 * reproduces only under speed.
 */
export async function resetRoomState(): Promise<void> {
  const admin = createAdminClient();
  await admin.from('multiplayer_room_members').delete().neq('room_code', '');
  await admin.from('multiplayer_rooms').delete().neq('code', '');
  await admin.from('room_join_attempts').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
}

/** Signs a browser page in through the real UI form — no injected session, no test-only hook in
 *  production code. Assumes the page has already completed guest onboarding and is on Home. */
export async function signInThroughUi(page: Page, user: TestUser): Promise<void> {
  await page.getByRole('button', { name: /sign in/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(user.email);
  await dialog.getByLabel('Password').fill(user.password);
  await dialog.getByRole('button', { name: /^sign in$/i }).click();
  // The modal closes once the session lands; that is the signal auth actually succeeded.
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
}

/** Walks guest onboarding to Home — the precondition for signInThroughUi. Mirrors smoke.spec.ts's
 *  path; kept here so the multiplayer suite does not import from another spec file.
 *
 * Updated for the 2026-08-30 value-before-signup reorder: "Get Started" now always leads to skill
 * selection first (no longer branches on supabaseReady), then a firstSign step (skipped here — no
 * fake camera device in this stack either, see playwright.multiplayer.config.ts), and only then
 * the auth step where "Continue as guest" actually lives now. */
export async function reachHome(page: Page): Promise<void> {
  await page.goto('/app');
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /just starting/i }).click();
  await page.getByRole('button', { name: /skip for now/i }).click();
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.getByRole('button', { name: /sign in/i }).first().waitFor({ timeout: 15_000 });
}
