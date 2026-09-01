import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  STACK_URL, STACK_ANON_KEY, assertLocalOnly, probeStack,
  createAdminClient, ensureTestUsers, type TestUser,
} from './support/multiplayerStack';

/**
 * Authorization regression tests for the two findings in the 2026-09-01 security audit
 * (SECURITY_AUDIT/FINDINGS.md F-001, F-002). Both were authorization bypasses reachable by any
 * authenticated user holding nothing but the public anon key and their own valid JWT.
 *
 * These run against the LOCAL Supabase stack only (assertLocalOnly), with synthetic accounts —
 * never production. They exist so a future migration cannot silently reintroduce either hole:
 * both were originally created by a policy/trigger MISMATCH rather than by an obviously wrong
 * policy, which is exactly the class of regression that reading a diff does not catch.
 *
 * Run: npx playwright test e2e/security-rls.spec.ts --config=playwright.multiplayer.config.ts
 */

/** ensureTestUsers() returns an array; these specs need two specific accounts, so assert on their
 *  presence rather than sprinkling non-null assertions through every test. */
async function twoUsers(): Promise<[TestUser, TestUser]> {
  const users = await ensureTestUsers();
  const [first, second] = users;
  if (!first || !second) throw new Error(`expected 2 synthetic test users, got ${users.length}`);
  return [first, second];
}

/** A PostgREST client bound to a real end-user JWT — the exact privilege an attacker has. */
async function clientAs(user: TestUser) {
  const c = createClient(STACK_URL, STACK_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`could not sign in ${user.email}: ${error.message}`);
  return c;
}

test.describe('security regressions — RLS authorization', () => {
  test.beforeAll(async () => {
    assertLocalOnly();
    const probe = await probeStack();
    // Mirrors probeStack()'s own contract: an absent stack (no Docker) skips, but a stack that is
    // up with wrong keys/schema must FAIL loudly — a misconfigured security suite that silently
    // skips is indistinguishable from one that passed, which is the worst possible outcome here.
    if (probe.misconfigured) {
      throw new Error(`local Supabase stack is misconfigured: ${probe.misconfigured}`);
    }
    test.skip(!probe.reachable, 'local Supabase stack not running — start it with `supabase start`');
  });

  // ── F-001 ────────────────────────────────────────────────────────────────────────────────────
  // `rooms_select_all` was `for select to authenticated using (true)`, letting any logged-in user
  // read the `code` of every PRIVATE room and then join it via join_multiplayer_room() (which
  // deliberately does not check visibility — holding the code IS the authorization). Because a
  // joined user becomes a real multiplayer_room_members row, they then satisfy the Realtime
  // Authorization policies too and receive the other participants' live webcam stream over WebRTC.
  test('F-001: a non-member cannot read another user\'s private room code', async () => {
    const [alice, bob] = await twoUsers();
    const admin = createAdminClient();
    const code = `SECT${Date.now().toString().slice(-4)}`;

    await admin.from('multiplayer_rooms').delete().eq('code', code);
    const { error: insErr } = await admin.from('multiplayer_rooms').insert({
      code, mode: 'duel', visibility: 'private', host_id: alice.id, max_participants: 2,
    });
    expect(insErr, 'fixture room should insert via service role').toBeNull();

    try {
      const bobClient = await clientAs(bob);
      const { data } = await bobClient.from('multiplayer_rooms').select('code').eq('code', code);
      // The row must be invisible to a non-member. Before the fix this returned the row, handing
      // over the join code for a room Bob was never invited to.
      expect(data ?? [], 'a non-member must not be able to read a private room row').toEqual([]);
    } finally {
      await admin.from('multiplayer_rooms').delete().eq('code', code);
    }
  });

  test('F-001: the room host can still read their own room (fix must not break hosting)', async () => {
    const [alice] = await twoUsers();
    const admin = createAdminClient();
    const code = `SECH${Date.now().toString().slice(-4)}`;

    await admin.from('multiplayer_rooms').delete().eq('code', code);
    await admin.from('multiplayer_rooms').insert({
      code, mode: 'duel', visibility: 'private', host_id: alice.id, max_participants: 2,
    });

    try {
      const aliceClient = await clientAs(alice);
      const { data } = await aliceClient.from('multiplayer_rooms').select('code').eq('code', code);
      expect(data?.length, 'the host must still see their own room').toBe(1);
    } finally {
      await admin.from('multiplayer_rooms').delete().eq('code', code);
    }
  });

  // ── F-002 ────────────────────────────────────────────────────────────────────────────────────
  // guard_progress_deltas_trg is BEFORE UPDATE only, so DELETE + INSERT bypassed the economy
  // ceiling entirely without ever performing an UPDATE. Two independent guards now close it:
  // the DELETE policy is gone, and INSERT is capped.
  test('F-002: a user cannot delete their own progress row (closes the delete+insert chain)', async () => {
    const [alice] = await twoUsers();
    const aliceClient = await clientAs(alice);

    await aliceClient.from('user_progress').delete().eq('user_id', alice.id);

    // RLS denies rather than errors: with no DELETE policy the row simply does not match, so the
    // statement affects zero rows. Assert on the surviving row, which is what actually matters.
    const admin = createAdminClient();
    const { data } = await admin.from('user_progress').select('user_id').eq('user_id', alice.id);
    expect(data?.length, 'the progress row must survive a client-issued DELETE').toBe(1);
  });

  test('F-002: an INSERT cannot mint an arbitrary economy balance', async () => {
    const [, bob] = await twoUsers();
    const admin = createAdminClient();

    // Reach the INSERT path the guard protects: remove the row with service role (a client can no
    // longer do this — see the test above), then attempt the attacker's insert as the user.
    await admin.from('user_progress').delete().eq('user_id', bob.id);
    try {
      const bobClient = await clientAs(bob);
      await bobClient.from('user_progress').insert({
        user_id: bob.id, gold: 999_999_999, xp: 999_999_999, signs: 999_999,
        total_correct_signs: 999_999, rename_cards: 999, streak_freezes: 999,
      });

      const { data } = await admin
        .from('user_progress')
        .select('gold, xp, signs, rename_cards')
        .eq('user_id', bob.id)
        .maybeSingle();

      if (data) {
        // Capped, not zeroed — useProgressSync upserts real progress through this same INSERT path
        // when a row is missing, so zeroing would wipe a legitimate user's save.
        expect(data.gold, 'gold must be capped at the ceiling').toBeLessThanOrEqual(20_000);
        expect(data.xp, 'xp must be capped at the ceiling').toBeLessThanOrEqual(10_000);
        expect(data.signs, 'signs must be capped at the ceiling').toBeLessThanOrEqual(2_000);
        expect(data.rename_cards, 'rename_cards must be capped').toBeLessThanOrEqual(20);
      }
    } finally {
      await admin.from('user_progress').delete().eq('user_id', bob.id);
      await admin.from('user_progress').insert({ user_id: bob.id });
    }
  });

  // ── Standing invariants (would have caught both findings as a class) ─────────────────────────
  test('anonymous callers cannot read any room or any progress row', async () => {
    const anon = createClient(STACK_URL, STACK_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rooms = await anon.from('multiplayer_rooms').select('code').limit(1);
    expect(rooms.data ?? [], 'anon must never read multiplayer_rooms').toEqual([]);
  });

  test('a user cannot promote themselves to admin', async () => {
    const [alice] = await twoUsers();
    const aliceClient = await clientAs(alice);
    await aliceClient.from('profiles').update({ is_admin: true }).eq('id', alice.id);

    const admin = createAdminClient();
    const { data } = await admin.from('profiles').select('is_admin').eq('id', alice.id).maybeSingle();
    expect(data?.is_admin, 'self-promotion to admin must be rejected').toBe(false);
  });
});
