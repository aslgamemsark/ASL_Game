import { test, expect, type Browser, type Page, type WebSocketRoute } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertLocalOnly,
  createAdminClient,
  createAnonClient,
  ensureTestUsers,
  probeStack,
  reachHome,
  resetRoomState,
  signInThroughUi,
  type TestUser,
} from './support/multiplayerStack';

/**
 * Multiplayer integration suite.
 *
 * Runs against a LOCAL Supabase stack (`supabase start`) — never the hosted production project.
 * See docs/MULTIPLAYER_TESTING.md for the one-time setup, and playwright.multiplayer.config.ts for
 * how the app under test is pointed at the local stack (build-time env only; no production code
 * knows this suite exists and there is no test-only auth bypass — the browser tests sign in through
 * the real form against real GoTrue).
 *
 * Split deliberately into two layers, because the two halves of "multiplayer" fail in different
 * places:
 *
 *   PART A — the room registry, driven directly through the RPCs. Concurrency lives here: the
 *   join race is a `for update` row lock inside join_multiplayer_room, not anything the UI does.
 *   Driving two browsers to race for a slot would test the same lock far more slowly and far less
 *   deterministically, and would fail for scheduling reasons unrelated to the lock.
 *
 *   PART B — two real browser contexts with fake media devices, exercising the parts that only
 *   exist in the browser: presence, WebRTC signaling handoff, and how the UI reacts to a peer
 *   arriving, the tab backgrounding, or the network dropping.
 *
 * If the local stack is not running the suite SKIPS with an explanatory message (a machine without
 * Docker cannot run it). If the stack IS running but misconfigured, it FAILS — a suite that cannot
 * distinguish those two is how this repo previously shipped a CI job that had never once run.
 */

const DUEL_MAX = 2;

let stackReady = false;
let users: TestUser[] = [];

test.beforeAll(async () => {
  assertLocalOnly();
  const probe = await probeStack();
  if (probe.misconfigured) {
    throw new Error(
      `Local Supabase stack is reachable but not usable: ${probe.misconfigured}\n` +
      'See docs/MULTIPLAYER_TESTING.md.'
    );
  }
  if (!probe.reachable) {
    if (process.env.CI) throw new Error('CI requires a running local Supabase stack; refusing to skip multiplayer validation.');
    return;
  }
  users = await ensureTestUsers();
  stackReady = true;
});

test.beforeEach(async () => {
  test.skip(
    !stackReady,
    'Local Supabase stack not running — start it with `npx supabase start` (needs Docker). ' +
    'See docs/MULTIPLAYER_TESTING.md.'
  );
  await resetRoomState();
});

test.afterEach(async ({ browser }, testInfo) => {
  // These tests own multiple contexts; capture both clients when a handshake assertion fails.
  if (testInfo.status === testInfo.expectedStatus) return;
  for (const [index, page] of browser.contexts().flatMap((context) => context.pages()).entries()) {
    const body = await page.locator('body').innerText({ timeout: 2_000 }).catch(() => 'Page unavailable');
    console.error(`Multiplayer failure page ${index}: ${body.slice(0, 4_000)}`);
  }
});

/** Authenticated PostgREST client for a fixture user — the same anon key the app ships with, plus
 *  a real signed-in session, so RLS and auth.uid() behave exactly as they do in production. */
async function clientFor(user: TestUser): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`Fixture sign-in failed for ${user.email}: ${error.message}`);
  return client;
}

/** Exercise the RPC wire contract independently of the production wrapper. */
async function joinRoom(client: SupabaseClient, code: string) {
  const response = await client.rpc('join_multiplayer_room_v2', { p_code: code });
  expect(response.error, 'expected join denials must commit the throttle, not raise').toBeNull();
  const result = response.data as { room: { participant_count: number } | null; error: string | null };
  expect(result).toHaveProperty('room');
  expect(result).toHaveProperty('error');
  return { data: result.room, error: result.error === null ? null : { message: result.error } };
}

/** Creates a duel room owned by `host`, mirroring DuelPage.createRoom's insert exactly. */
async function createRoom(
  host: SupabaseClient,
  hostId: string,
  code: string,
  visibility: 'public' | 'private' = 'private',
): Promise<void> {
  const { error } = await host.from('multiplayer_rooms').insert({
    code,
    mode: 'duel',
    visibility,
    host_id: hostId,
    max_participants: DUEL_MAX,
  });
  if (error) throw new Error(`Room creation failed: ${error.message}`);
}

/** Unique per test so a leaked row from a previous run can never make one pass spuriously. */
function uniqueCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART A — room registry and its concurrency guarantees
// ─────────────────────────────────────────────────────────────────────────────

test.describe('multiplayer room registry', () => {
  test('duel creation tolerates an existing challenge room and only its host can delete it', async () => {
    const host = await clientFor(users[0]!);
    const guest = await clientFor(users[1]!);
    const code = uniqueCode();
    const row = { code, mode: 'duel', visibility: 'private', host_id: users[0]!.id, max_participants: 2 };
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await host.from('multiplayer_rooms').upsert(row, { onConflict: 'code', ignoreDuplicates: true })).error).toBeNull();
    }
    expect((await joinRoom(guest, code)).error).toBeNull();
    expect((await guest.from('multiplayer_rooms').delete().eq('code', code)).error).toBeNull();
    expect((await host.from('multiplayer_rooms').select('code').eq('code', code)).data).toEqual([{ code }]);
    expect((await host.from('multiplayer_rooms').delete().eq('code', code)).error).toBeNull();
    const remaining = await createAdminClient().from('multiplayer_rooms').select('code').eq('code', code);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([]);
  });

  test('a host creates a room and it is joinable by its code', async () => {
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);

    const { data, error } = await joinRoom(guestClient, code);
    expect(error, 'a valid code must join cleanly').toBeNull();
    expect((data as { participant_count: number }).participant_count,
      'the joiner must claim a slot alongside the host').toBe(2);
  });

  test('a lowercase code still joins — codes are matched case-insensitively', async () => {
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);

    const { error } = await joinRoom(guestClient, code.toLowerCase());
    expect(error, 'join_multiplayer_room upper()s the code, so case must not matter').toBeNull();
  });

  test('simultaneous joins for the last slot: exactly one wins, the other is told the room is full',
    async () => {
      // The core race. Both calls hit the same room row inside the same instant; the `for update`
      // lock in join_multiplayer_room is the only thing preventing both from claiming slot 2 and
      // leaving participant_count at 3 in a 2-player duel.
      const [host, a, b] = [users[0]!, users[1]!, users[2]!];
      const hostClient = await clientFor(host);
      const clientA = await clientFor(a);
      const clientB = await clientFor(b);
      const code = uniqueCode();

      await createRoom(hostClient, host.id, code);

      const [resultA, resultB] = await Promise.all([
        joinRoom(clientA, code),
        joinRoom(clientB, code),
      ]);

      const succeeded = [resultA, resultB].filter((r) => !r.error);
      const failed = [resultA, resultB].filter((r) => r.error);

      expect(succeeded, 'exactly one of two simultaneous joiners must get the last slot').toHaveLength(1);
      expect(failed, 'the loser of the race must be rejected, not silently over-admitted').toHaveLength(1);
      expect(failed[0]!.error!.message).toContain('room full');

      const { data: room } = await hostClient
        .from('multiplayer_rooms').select('participant_count').eq('code', code).single();
      expect((room as { participant_count: number }).participant_count,
        'participant_count must never exceed max_participants, whatever the interleaving').toBe(DUEL_MAX);
    });

  test('a duplicate join from the same player is idempotent and does not burn a slot', async () => {
    // Guards migration 20260731120000. Before it, a double-tapped Join incremented
    // participant_count twice, so a 2-player duel filled up with one human in it and the real
    // opponent was then refused.
    const [host, guest, third] = [users[0]!, users[1]!, users[2]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const thirdClient = await clientFor(third);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);

    const first = await joinRoom(guestClient, code);
    expect(first.error).toBeNull();
    const second = await joinRoom(guestClient, code);
    expect(second.error, 'a repeat join by an existing member must succeed, not error').toBeNull();

    const { data: room } = await hostClient
      .from('multiplayer_rooms').select('participant_count').eq('code', code).single();
    expect((room as { participant_count: number }).participant_count,
      're-entry must not claim a second slot').toBe(2);

    // And the room must genuinely still be full for a stranger — idempotency must not have
    // quietly freed capacity either.
    const outsider = await joinRoom(thirdClient, code);
    expect(outsider.error?.message, 'a third player must still be refused').toContain('room full');
  });

  test('an existing member can rejoin a match already in progress (reconnect), a stranger cannot',
    async () => {
      // The reconnect path. Once the host starts the match the room is 'in_progress'; before
      // migration 20260731120000 a player whose socket dropped got 'room already started' and had
      // no way back into a game they were still a member of.
      const [host, guest, stranger] = [users[0]!, users[1]!, users[3]!];
      const hostClient = await clientFor(host);
      const guestClient = await clientFor(guest);
      const strangerClient = await clientFor(stranger);
      const code = uniqueCode();

      await createRoom(hostClient, host.id, code);
      await joinRoom(guestClient, code);

      // Host starts the match — the same direct status UPDATE DuelPage performs.
      await hostClient.from('multiplayer_rooms').update({ status: 'in_progress' }).eq('code', code);

      const rejoin = await joinRoom(guestClient, code);
      expect(rejoin.error, 'a member must be able to reconnect into their own in-progress match')
        .toBeNull();

      const gatecrash = await joinRoom(strangerClient, code);
      expect(gatecrash.error?.message, 'a non-member must still be kept out of a started match')
        .toContain('already started');
    });

  test('a closed room refuses joins, including from a player who was previously a member', async () => {
    // Room destruction. DuelPage closes the room on host exit; nobody may re-enter afterwards —
    // not even someone whose membership row still exists, or the idempotent-rejoin path above
    // would resurrect a destroyed room.
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);
    await joinRoom(guestClient, code);

    await hostClient.from('multiplayer_rooms').update({ status: 'closed' }).eq('code', code);

    const rejoin = await joinRoom(guestClient, code);
    expect(rejoin.error?.message, 'a closed room must stay closed to everyone').toContain('closed');
  });

  test('an unknown code is refused without revealing anything else', async () => {
    const guestClient = await clientFor(users[1]!);
    const { error } = await joinRoom(guestClient, uniqueCode());
    expect(error?.message).toContain('not found');
  });

  test('leaving frees the slot for someone else', async () => {
    const [host, guest, third] = [users[0]!, users[1]!, users[2]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const thirdClient = await clientFor(third);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);
    await joinRoom(guestClient, code);
    expect((await joinRoom(thirdClient, code)).error?.message)
      .toContain('room full');

    await guestClient.rpc('leave_multiplayer_room', { p_code: code });

    const { error } = await joinRoom(thirdClient, code);
    expect(error, 'the freed slot must be claimable').toBeNull();
  });

  test('nonmembers, anonymous callers and duplicate leaves cannot remove other players', async () => {
    const hostClient = await clientFor(users[0]!);
    const guestClient = await clientFor(users[1]!);
    const outsider = await clientFor(users[2]!);
    const code = uniqueCode();
    await createRoom(hostClient, users[0]!.id, code);
    expect((await joinRoom(guestClient, code)).error).toBeNull();
    expect((await createAnonClient().rpc('leave_multiplayer_room', { p_code: code })).error).not.toBeNull();
    expect((await outsider.rpc('leave_multiplayer_room', { p_code: code })).error).toBeNull();
    const before = await hostClient.from('multiplayer_rooms').select('participant_count').eq('code', code).single();
    expect(before.error).toBeNull();
    expect(before.data?.participant_count).toBe(2);

    const leaves = await Promise.all([
      guestClient.rpc('leave_multiplayer_room', { p_code: code.toLowerCase() }),
      guestClient.rpc('leave_multiplayer_room', { p_code: code }),
    ]);
    for (const leave of leaves) expect(leave.error).toBeNull();
    expect((await guestClient.rpc('leave_multiplayer_room', { p_code: code })).error).toBeNull();
    const after = await hostClient.from('multiplayer_rooms').select('participant_count').eq('code', code).single();
    expect(after.error).toBeNull();
    expect(after.data?.participant_count).toBe(1);
    const members = await createAdminClient().from('multiplayer_room_members').select('user_id').eq('room_code', code);
    expect(members.error).toBeNull();
    expect(members.data).toEqual([{ user_id: users[0]!.id }]);
  });

  test('a concurrent leave and join preserve membership and capacity', async () => {
    const hostClient = await clientFor(users[0]!);
    const guestClient = await clientFor(users[1]!);
    const nextClient = await clientFor(users[2]!);
    const code = uniqueCode();
    await createRoom(hostClient, users[0]!.id, code);
    expect((await joinRoom(guestClient, code)).error).toBeNull();
    const [leave, join] = await Promise.all([
      guestClient.rpc('leave_multiplayer_room', { p_code: code }),
      joinRoom(nextClient, code),
    ]);
    expect(leave.error).toBeNull();
    // Either order is valid: join can see the full room before leave claims its lock.
    if (join.error) expect(join.error.message).toContain('room full');
    const room = await hostClient.from('multiplayer_rooms').select('participant_count').eq('code', code).single();
    const members = await createAdminClient().from('multiplayer_room_members').select('user_id').eq('room_code', code);
    expect(room.error).toBeNull();
    expect(members.error).toBeNull();
    expect(room.data?.participant_count).toBe(join.error ? 1 : 2);
    expect(members.data?.length).toBe(room.data?.participant_count);
    expect(members.data?.some(m => m.user_id === users[1]!.id)).toBe(false);
    expect((await joinRoom(nextClient, code)).error).toBeNull();
  });

  test('a stranger cannot enumerate private room codes but a member can read their room', async () => {
    const hostClient = await clientFor(users[0]!);
    const guestClient = await clientFor(users[1]!);
    const code = uniqueCode();
    await createRoom(hostClient, users[0]!.id, code);
    const hidden = await guestClient.from('multiplayer_rooms').select('code');
    expect(hidden.error).toBeNull();
    expect(hidden.data?.some(room => room.code === code)).toBe(false);
    expect((await joinRoom(guestClient, code)).error).toBeNull();
    const visible = await guestClient.from('multiplayer_rooms').select('code').eq('code', code);
    expect(visible.error).toBeNull();
    expect(visible.data).toEqual([{ code }]);
  });

  test('a host cannot forge headcounts or change capacity through direct writes', async () => {
    const hostClient = await clientFor(users[0]!);
    const code = uniqueCode();
    await createRoom(hostClient, users[0]!.id, code);
    for (const patch of [{ participant_count: 0 }, { max_participants: 100 }]) {
      expect((await hostClient.from('multiplayer_rooms').update(patch).eq('code', code)).error).not.toBeNull();
    }
    const forged = await hostClient.from('multiplayer_rooms').insert({
      code: uniqueCode(), host_id: users[0]!.id, mode: 'duel', max_participants: 2, participant_count: 0,
    });
    expect(forged.error).not.toBeNull();
    expect((await hostClient.from('multiplayer_rooms').update({ status: 'in_progress' }).eq('code', code)).error).toBeNull();
  });

  test('public rooms are discoverable by search; private rooms are not', async () => {
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);

    const privateCode = uniqueCode();
    await createRoom(hostClient, host.id, privateCode, 'private');

    const hidden = await guestClient.rpc('find_public_room', { p_mode: 'duel' });
    expect((hidden.data as { code?: string } | null)?.code ?? null,
      'a private room must never surface in public search').not.toBe(privateCode);

    const publicCode = uniqueCode();
    await createRoom(hostClient, host.id, publicCode, 'public');

    const found = await guestClient.rpc('find_public_room', { p_mode: 'duel' });
    expect((found.data as { code?: string } | null)?.code,
      'a public waiting room must be findable').toBe(publicCode);
  });

  test('search never returns a room you host — the self-match bug', async () => {
    // THE bug that made multiplayer unusable in production (migration 20260731130000).
    // find_public_room had no filter on who was asking, so tapping "Search for a Match" right
    // after creating a public room returned your OWN room. Joining it pushed participant_count to
    // 2/2 while the membership insert no-op'd on the primary key, so the room advertised as FULL
    // with one person in it: the real opponent got 'room full', and the host waited forever.
    // Reproduced from production rows before fixing — three of four duel rooms in one session had
    // participant_count = 2 and exactly one member, who was the host.
    const host = users[0]!;
    const hostClient = await clientFor(host);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code, 'public');

    const found = await hostClient.rpc('find_public_room', { p_mode: 'duel' });
    expect((found.data as { code?: string } | null)?.code ?? null,
      'a room you host must never be offered to you as a match').not.toBe(code);
  });

  test('search never returns a room you already joined', async () => {
    // The same class as above one step later: back out of a room you joined and search again, and
    // the old query would hand you straight back into it.
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    // 4-seat room so it still has a free slot after the guest joins — otherwise the capacity
    // filter alone would hide it and the test would pass without exercising the membership check.
    const { error: createError } = await hostClient.from('multiplayer_rooms').insert({
      code, mode: 'duel', visibility: 'public', host_id: host.id, max_participants: 4,
    });
    expect(createError).toBeNull();
    await joinRoom(guestClient, code);

    const found = await guestClient.rpc('find_public_room', { p_mode: 'duel' });
    expect((found.data as { code?: string } | null)?.code ?? null,
      'a room you are already a member of must never be offered as a new match').not.toBe(code);
  });

  test('joining your own room does not fill it against the real opponent', async () => {
    // The second half of the same defect, guarded independently (migration 20260731120000): even
    // if some other path hands a host their own code, the join must not consume a seat.
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code, 'public');
    await joinRoom(hostClient, code);

    const { data: room } = await hostClient
      .from('multiplayer_rooms').select('participant_count').eq('code', code).single();
    expect((room as { participant_count: number }).participant_count,
      'a host joining their own room must not consume the opponent\'s seat').toBe(1);

    const opponent = await joinRoom(guestClient, code);
    expect(opponent.error, 'the real opponent must still be able to get in').toBeNull();
  });

  test('participant_count never disagrees with the membership table', async () => {
    // The invariant whose violation made the production bug diagnosable after the fact. Asserted
    // directly, because every way of breaking it produces a room that lies about how full it is.
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const admin = createAdminClient();
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);
    await joinRoom(guestClient, code);
    await joinRoom(guestClient, code); // duplicate
    await joinRoom(hostClient, code);  // self-join

    const { data: room } = await hostClient
      .from('multiplayer_rooms').select('participant_count').eq('code', code).single();
    const { data: members } = await admin
      .from('multiplayer_room_members').select('user_id').eq('room_code', code);

    expect((room as { participant_count: number }).participant_count,
      'participant_count must equal the number of real members, whatever join calls arrived')
      .toBe((members ?? []).length);
  });

  test('the last player leaving deletes the room instead of leaving it forever', async () => {
    // Rooms were never deleted: production still held 'waiting' rooms from days earlier, because
    // leave_multiplayer_room only decremented. Restored in migration 20260731140000 — which also
    // had to MERGE the behaviour, since 20260718010000 had silently reverted it by re-creating the
    // function without the delete.
    const host = users[0]!;
    const hostClient = await clientFor(host);
    const admin = createAdminClient();
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);
    await hostClient.rpc('leave_multiplayer_room', { p_code: code });

    const { data } = await admin.from('multiplayer_rooms').select('code').eq('code', code);
    expect(data ?? [], 'a room nobody is left in must not survive').toHaveLength(0);
  });

  test('the stale-room sweep removes rooms nobody ever exited', async () => {
    // The safety net for a crashed tab or a dead battery, which fire no client code at all.
    const host = users[0]!;
    const hostClient = await clientFor(host);
    const admin = createAdminClient();
    const stale = uniqueCode();
    const fresh = uniqueCode();

    await createRoom(hostClient, host.id, stale);
    await createRoom(hostClient, host.id, fresh);
    // Backdate one past the 30-minute waiting-room window.
    await admin.from('multiplayer_rooms')
      .update({ created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq('code', stale);

    await admin.rpc('cleanup_stale_multiplayer_rooms');

    const { data: staleRow } = await admin.from('multiplayer_rooms').select('code').eq('code', stale);
    const { data: freshRow } = await admin.from('multiplayer_rooms').select('code').eq('code', fresh);
    expect(staleRow ?? [], 'an abandoned room must be swept').toHaveLength(0);
    expect(freshRow ?? [], 'a room created moments ago must NOT be swept').toHaveLength(1);
  });

  test('a closed public room drops out of search results', async () => {
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code, 'public');
    await hostClient.from('multiplayer_rooms').update({ status: 'closed' }).eq('code', code);

    const found = await guestClient.rpc('find_public_room', { p_mode: 'duel' });
    expect((found.data as { code?: string } | null)?.code ?? null,
      'search must not offer rooms nobody can join').not.toBe(code);
  });

  test('wrong-code attempts persist, throttle at eleven and reset after the window', async () => {
    const guest = users[2]!;
    const guestClient = await clientFor(guest);
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect((await joinRoom(guestClient, uniqueCode())).error?.message).toBe('room not found');
    }
    const admin = createAdminClient();
    const count = await admin.from('room_join_attempts').select('attempts').eq('user_id', guest.id).single();
    expect(count.error).toBeNull();
    expect(count.data?.attempts).toBe(10);
    expect((await joinRoom(guestClient, uniqueCode())).error?.message).toBe('too many join attempts');
    const hostClient = await clientFor(users[0]!);
    const code = uniqueCode();
    await createRoom(hostClient, users[0]!.id, code);
    expect((await joinRoom(guestClient, code)).error?.message).toBe('too many join attempts');
    expect((await guestClient.rpc('join_multiplayer_room', { p_code: code })).error,
      'the legacy RPC must not bypass the throttle').not.toBeNull();
    expect((await createAnonClient().rpc('join_multiplayer_room_v2', { p_code: code })).error).not.toBeNull();

    const expired = await admin.from('room_join_attempts')
      .update({ window_start: new Date(Date.now() - 120_000).toISOString() }).eq('user_id', guest.id);
    expect(expired.error).toBeNull();
    expect((await joinRoom(guestClient, code)).error).toBeNull();
    const reset = await admin.from('room_join_attempts').select('attempts').eq('user_id', guest.id).single();
    expect(reset.error).toBeNull();
    expect(reset.data?.attempts).toBe(1);
  });

  test('a player cannot create a room owned by someone else', async () => {
    // RLS check: rooms_insert_own requires host_id = auth.uid(). Without it, anyone could plant a
    // room attributed to another account.
    const impostor = await clientFor(users[1]!);
    const { error } = await impostor.from('multiplayer_rooms').insert({
      code: uniqueCode(),
      mode: 'duel',
      visibility: 'private',
      host_id: users[0]!.id,
      max_participants: DUEL_MAX,
    });
    expect(error, 'RLS must reject a room inserted with someone else as host').not.toBeNull();
  });

  test('a non-host cannot close or start someone else\'s room', async () => {
    const [host, guest] = [users[0]!, users[1]!];
    const hostClient = await clientFor(host);
    const guestClient = await clientFor(guest);
    const code = uniqueCode();

    await createRoom(hostClient, host.id, code);
    await guestClient.from('multiplayer_rooms').update({ status: 'closed' }).eq('code', code);

    const { data } = await hostClient
      .from('multiplayer_rooms').select('status').eq('code', code).single();
    expect((data as { status: string }).status,
      'only the host may change room status').toBe('waiting');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART B — two real browser clients
// ─────────────────────────────────────────────────────────────────────────────

/** Signs a fresh context in and parks it on the Duel lobby. */
async function openDuelLobby(browser: Browser, user: TestUser, setup?: (page: Page) => Promise<void>): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await setup?.(page);
  page.on('pageerror', (error) => console.error(`Multiplayer page error: ${error.message}`));
  await reachHome(page);
  await signInThroughUi(page, user);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first().click();
  await page.getByRole('button', { name: /Multiplayer$/ }).first().click();
  await page.getByRole('button', { name: 'Allow Camera', exact: true }).click();
  // Multiplayer now opens straight into the duel lobby — the separate "pick a mode" screen was
  // replaced by the 1v1 / Group switcher inside the lobby itself (2026-08-03). Clicking the 1v1
  // segment is therefore a no-op confirmation of the default rather than a navigation step, and is
  // kept so the test fails loudly if the switcher ever stops being rendered.
  await page.getByRole('button', { name: /1v1 Duel/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign & Guess', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Create Room$/ })).toBeVisible({ timeout: 15_000 });
  return page;
}

/** Wait for the actual waiting-room code, not the lobby input label or typography. */
async function readRoomCode(page: Page): Promise<string> {
  const code = page.getByText('Room Code', { exact: true }).locator('..').locator('p').last();
  await expect(code).toHaveText(/^[A-Z2-9]{8}$/);
  return (await code.innerText()).trim();
}

const IN_ROUND = /SIGN THIS|What are they signing/;

test.describe('multiplayer two-client session', () => {
  test('host creates a room, a second client joins by code, and both enter the match', async ({ browser }) => {
    const hostPage = await openDuelLobby(browser, users[0]!);
    const guestPage = await openDuelLobby(browser, users[1]!);

    await hostPage.getByRole('button', { name: /^Create Room$/ }).click();
    await expect(hostPage.getByText('Room Code', { exact: true })).toBeVisible({ timeout: 20_000 });

    const code = await readRoomCode(hostPage);
    expect(code, 'the host must be shown a shareable room code').toMatch(/^[A-Z2-9]{8}$/);

    await guestPage.getByLabel('Room code').fill(code);
    await expect(guestPage.getByLabel('Room code')).toHaveValue(code);
    await guestPage.getByRole('button', { name: /^Join$/ }).click();

    await expect(hostPage.getByText(IN_ROUND),
      'the host must advance out of the waiting room when a peer arrives').toBeVisible({ timeout: 30_000 });
    await expect(guestPage.getByText(IN_ROUND),
      'the joiner must receive the start handoff').toBeVisible({ timeout: 30_000 });

    await hostPage.context().close();
    await guestPage.context().close();
  });

  test('the lobby switches between 1v1 and Group without leaving the screen', async ({ browser }) => {
    // The merged lobby replaced a separate mode-picker screen; the switcher is now the only way to
    // reach Group Room, so if it stops swapping modes that whole mode becomes unreachable.
    const page = await openDuelLobby(browser, users[0]!);

    await expect(page.getByRole('heading', { name: /Sign & Guess/ })).toBeVisible();
    await page.getByRole('button', { name: /Group Room/ }).click();
    await expect(page.getByRole('heading', { name: /Group Sign & Guess/ }),
      'the Group segment must swap the lobby to room mode').toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Group Room/ }).click();
    await expect(page.getByRole('heading', { name: 'Group Sign & Guess', exact: true }),
      'selecting the active mode must leave that mode selected').toBeVisible();

    await page.getByRole('button', { name: /1v1 Duel/ }).click();
    await expect(page.getByRole('heading', { name: /^Sign & Guess$/ }),
      'and back again').toBeVisible({ timeout: 10_000 });

    await page.context().close();
  });

  test('a wrong code is refused in the UI without leaving the lobby', async ({ browser }) => {
    const guestPage = await openDuelLobby(browser, users[1]!);

    await guestPage.getByLabel('Room code').fill(uniqueCode());
    await guestPage.getByRole('button', { name: /^Join$/ }).click();

    await expect(guestPage.getByText(/invalid code/i),
      'a mistyped code must say so rather than hanging on an empty channel').toBeVisible({ timeout: 15_000 });
    await expect(guestPage.getByRole('button', { name: /^Create Room$/ }),
      'the lobby must remain usable after a failed join').toBeVisible();

    await guestPage.context().close();
  });

  test('a public room is reachable through Search without anyone typing a code', async ({ browser }) => {
    const hostPage = await openDuelLobby(browser, users[0]!);
    const guestPage = await openDuelLobby(browser, users[1]!);

    await hostPage.getByRole('button', { name: /Public/ }).click();
    await hostPage.getByRole('button', { name: /^Create Room$/ }).click();
    await expect(hostPage.getByText('Room Code', { exact: true })).toBeVisible({ timeout: 20_000 });

    await guestPage.getByRole('button', { name: /Search for a Match/ }).click();

    await expect(hostPage.getByText(IN_ROUND),
      'search must land the guest in the host\'s public room').toBeVisible({ timeout: 30_000 });
    await expect(guestPage.getByText(IN_ROUND)).toBeVisible({ timeout: 30_000 });

    await hostPage.context().close();
    await guestPage.context().close();
  });

  test('a double-tapped Join does not lock the room against the real opponent', async ({ browser }) => {
    // Duplicate-event coverage at the UI layer, where the double tap actually originates.
    const hostPage = await openDuelLobby(browser, users[0]!);
    const guestPage = await openDuelLobby(browser, users[1]!);

    await hostPage.getByRole('button', { name: /^Create Room$/ }).click();
    await expect(hostPage.getByText('Room Code', { exact: true })).toBeVisible({ timeout: 20_000 });
    const code = await readRoomCode(hostPage);

    await guestPage.getByLabel('Room code').fill(code);
    await expect(guestPage.getByLabel('Room code')).toHaveValue(code);
    const join = guestPage.getByRole('button', { name: /^Join$/ });
    await join.click();
    await join.click({ force: true }).catch(() => { /* button may already be gone — that is fine */ });

    await expect(guestPage.getByText(IN_ROUND),
      'a double tap must not refuse the joiner their own room').toBeVisible({ timeout: 30_000 });
    await expect(hostPage.getByText(IN_ROUND)).toBeVisible({ timeout: 30_000 });

    await hostPage.context().close();
    await guestPage.context().close();
  });

  test('backgrounding and restoring the tab does not drop the match', async ({ browser }) => {
    const hostPage = await openDuelLobby(browser, users[0]!);
    const guestPage = await openDuelLobby(browser, users[1]!);

    await hostPage.getByRole('button', { name: /^Create Room$/ }).click();
    await expect(hostPage.getByText('Room Code', { exact: true })).toBeVisible({ timeout: 20_000 });
    const code = await readRoomCode(hostPage);

    await guestPage.getByLabel('Room code').fill(code);
    await expect(guestPage.getByLabel('Room code')).toHaveValue(code);
    await guestPage.getByRole('button', { name: /^Join$/ }).click();
    await expect(guestPage.getByText(IN_ROUND)).toBeVisible({ timeout: 30_000 });

    // What a phone actually does when the user switches apps: the page is hidden, then restored.
    await guestPage.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await guestPage.waitForTimeout(1_500);
    await guestPage.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(guestPage.getByText(IN_ROUND),
      'returning from the background must not eject the player from the match').toBeVisible({ timeout: 15_000 });

    await hostPage.context().close();
    await guestPage.context().close();
  });

  test('a network interruption surfaces to the user and the session recovers', async ({ browser }) => {
    const hostPage = await openDuelLobby(browser, users[0]!);
    const guestPage = await openDuelLobby(browser, users[1]!);

    await hostPage.getByRole('button', { name: /^Create Room$/ }).click();
    await expect(hostPage.getByText('Room Code', { exact: true })).toBeVisible({ timeout: 20_000 });
    const code = await readRoomCode(hostPage);

    await guestPage.getByLabel('Room code').fill(code);
    await expect(guestPage.getByLabel('Room code')).toHaveValue(code);
    await guestPage.getByRole('button', { name: /^Join$/ }).click();
    await expect(guestPage.getByText(IN_ROUND)).toBeVisible({ timeout: 30_000 });

    await guestPage.context().setOffline(true);
    // The offline banner is the app's own global signal (Phase 5); it is the user-visible proof
    // that a dropped connection is communicated rather than silently swallowed.
    await expect(guestPage.getByRole('status', { name: /offline/i }),
      'a dropped connection must be told to the user').toBeVisible({ timeout: 15_000 });

    await guestPage.context().setOffline(false);
    await expect(guestPage.getByRole('status', { name: /offline/i }),
      'the banner must clear when connectivity returns').toBeHidden({ timeout: 20_000 });
    await expect(guestPage.getByText(IN_ROUND),
      'the match view must survive a transient interruption').toBeVisible({ timeout: 20_000 });

    await hostPage.context().close();
    await guestPage.context().close();
  });

  test('the duel lobby is usable at phone width', async ({ browser }) => {
    // Multiplayer is overwhelmingly played on a phone; the lobby's controls were also the last
    // sub-44px touch targets in the app (fixed 2026-07-31).
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await reachHome(page);
    await signInThroughUi(page, users[0]!);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Me/ }).first().click();
    await page.getByRole('button', { name: /Multiplayer$/ }).first().click();
    await page.getByRole('button', { name: 'Allow Camera', exact: true }).click();
    await page.getByRole('button', { name: /1v1 Duel/ }).click();

    for (const name of [/^Create Room$/, /Private/, /Public/, /^Join$/]) {
      const box = await page.getByRole('button', { name }).first().boundingBox();
      expect(box, `"${name}" must be present in the mobile lobby`).not.toBeNull();
      expect(box!.height, `"${name}" must meet the 44px touch-target minimum`).toBeGreaterThanOrEqual(44);
    }

    await context.close();
  });
});

// Completion coverage deliberately uses real guesses and real timeout clocks. Fake camera
// frames establish transport, but do not pretend to validate human ASL recognition.
test.describe('multiplayer match completion', () => {
  test('duel rotates roles, delivers remote frames and awards one point per correct guess', async ({ browser }) => {
    const pages = [await openDuelLobby(browser, users[0]!), await openDuelLobby(browser, users[1]!)];
    await pages[0]!.getByRole('button', { name: '3', exact: true }).click();
    await pages[0]!.getByRole('button', { name: '20s', exact: true }).click();
    await createAndJoin(pages);
    const scores: [number, number] = [0, 0];
    for (let round = 1; round <= 3; round++) {
      const signerIndex = (users[0]!.id < users[1]!.id) === (round % 2 === 1) ? 0 : 1;
      const signer = pages[signerIndex]!;
      const guesser = pages[1 - signerIndex]!;
      await expect(signer.getByText(/SIGN THIS/)).toBeVisible({ timeout: 20_000 });
      await expect(guesser.getByText(/What are they signing/)).toBeVisible();
      await expectRemoteFrames(guesser);
      const sign = await signer.getByText(/SIGN THIS/).locator('..').locator('p').last().innerText();
      await guesser.getByRole('button', { name: sign, exact: true }).click();
      scores[1 - signerIndex] = scores[1 - signerIndex]! + 1;
      await Promise.all(pages.map(page => expect(page.getByText('The sign was', { exact: true })).toBeVisible()));
    }
    for (const [index, page] of pages.entries()) {
      await expect(page.getByRole('heading', { name: scores[index]! > scores[1 - index]! ? 'You Won!' : 'You Lost', exact: true })).toBeVisible({ timeout: 20_000 });
      const board = page.getByText('vs', { exact: true }).locator('..');
      await expect(board.locator('p').nth(0)).toHaveText(String(scores[index]));
      await expect(board.locator('p').nth(2)).toHaveText(String(scores[1 - index]));
    }
    await Promise.all(pages.map(page => page.context().close()));
  });

  test('duel times out all rounds and finishes as a zero-score draw on both clients', async ({ browser }) => {
    const pages = [await openDuelLobby(browser, users[0]!), await openDuelLobby(browser, users[1]!)];
    await pages[0]!.getByRole('button', { name: '3', exact: true }).click();
    await pages[0]!.getByRole('button', { name: '10s', exact: true }).click();
    await createAndJoin(pages);
    for (const page of pages) {
      await expect(page.getByRole('heading', { name: 'Draw!', exact: true })).toBeVisible({ timeout: 70_000 });
      const board = page.getByText('vs', { exact: true }).locator('..');
      await expect(board.locator('p').nth(0)).toHaveText('0');
      await expect(board.locator('p').nth(2)).toHaveText('0');
    }
    await Promise.all(pages.map(page => page.context().close()));
  });

  test('four-player group rotates every signer and agrees on final scores', async ({ browser }) => {
    const pages: Page[] = [];
    for (const user of users) {
      const page = await openDuelLobby(browser, user);
      await page.getByRole('button', { name: /Group Room/ }).click();
      pages.push(page);
    }
    await pages[0]!.getByRole('button', { name: '1', exact: true }).click();
    await pages[0]!.getByRole('button', { name: '20s', exact: true }).click();
    await createAndJoin(pages);
    await expect(pages[0]!.getByText('Players (4/4)', { exact: true })).toBeVisible();
    await pages[0]!.getByRole('button', { name: 'Start Game', exact: true }).click();
    for (let signerIndex = 0; signerIndex < 4; signerIndex++) {
      const signer = pages[signerIndex]!;
      await expect(signer.getByText(/SIGN THIS/)).toBeVisible({ timeout: 20_000 });
      const sign = await signer.getByText(/SIGN THIS/).locator('..').locator('p').last().innerText();
      const guessers = pages.filter(page => page !== signer);
      await Promise.all(guessers.map(expectRemoteFrames));
      await Promise.all(guessers.map(page => page.getByRole('button', { name: sign, exact: true }).click()));
      await Promise.all(pages.map(page => expect(page.getByText('The sign was', { exact: true })).toBeVisible()));
    }
    for (const page of pages) {
      await expect(page.getByRole('heading', { name: 'Game Over!', exact: true })).toBeVisible({ timeout: 20_000 });
      // All four players guessed correctly in each of their three non-signing rounds.
      await expect(page.locator('p').filter({ hasText: /^3$/ })).toHaveCount(4);
    }
    await Promise.all(pages.map(page => page.context().close()));
  });
});

async function createAndJoin(pages: Page[]) {
  await pages[0]!.getByRole('button', { name: 'Create Room', exact: true }).click();
  const code = await readRoomCode(pages[0]!);
  for (const [index, page] of pages.slice(1).entries()) {
    await page.getByLabel('Room code', { exact: true }).fill(code);
    await expect(page.getByLabel('Room code', { exact: true }), 'joining must preserve the full generated code').toHaveValue(code);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeHidden({ timeout: 20_000 });
    // Roster acknowledgement, not camera startup timing, defines the group join order.
    if (await pages[0]!.getByRole('button', { name: 'Start Game', exact: true }).count()) {
      await expect(pages[0]!.getByText(`Players (${index + 2}/4)`, { exact: true })).toBeVisible({ timeout: 20_000 });
    }
  }
}

async function expectRemoteFrames(page: Page) {
  // Scope to the remote tile's existing caption, so a healthy LOCAL preview cannot make this pass.
  const video = page.getByText(/ — signing$/).locator('..').locator('video');
  await expect(video).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => video.evaluate(v => {
    const media = v as HTMLVideoElement;
    return media.readyState >= 2 && media.videoWidth > 0 && media.currentTime > 0;
  }), { message: 'the remote WebRTC video must decode frames', timeout: 15_000 }).toBe(true);
}

test('group guest recovers final scores after dropped completion broadcasts and socket reconnect', async ({ browser }) => {
  const host = await openDuelLobby(browser, users[0]!);
  let socket: WebSocketRoute | undefined;
  let serverSocket: WebSocketRoute | undefined;
  let dropCompletion = false;
  let dropped = 0;
  const guest = await openDuelLobby(browser, users[1]!, async page => {
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, route => {
      socket = route;
      const server = route.connectToServer();
      serverSocket = server;
      server.onMessage(message => {
        if (dropCompletion && /"(round-end|game-over)"/.test(message.toString())) {
          dropped++;
          return;
        }
        route.send(message);
      });
    });
  });
  for (const page of [host, guest]) await page.getByRole('button', { name: /Group Room/ }).click();
  await host.getByRole('button', { name: '1', exact: true }).click();
  await createAndJoin([host, guest]);
  await expect(host.getByText('Players (2/4)', { exact: true })).toBeVisible();
  await host.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(host.getByText(/SIGN THIS/)).toBeVisible({ timeout: 20_000 });
  let sign = await host.getByText(/SIGN THIS/).locator('..').locator('p').last().innerText();
  await guest.getByRole('button', { name: sign, exact: true }).click();
  await expect(guest.getByText(/SIGN THIS/)).toBeVisible({ timeout: 15_000 });
  sign = await guest.getByText(/SIGN THIS/).locator('..').locator('p').last().innerText();
  dropCompletion = true;
  await host.getByRole('button', { name: sign, exact: true }).click();
  await expect(host.getByRole('heading', { name: 'Game Over!', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => dropped).toBeGreaterThanOrEqual(2);
  await expect(guest.getByRole('heading', { name: 'Game Over!', exact: true })).toBeHidden();
  dropCompletion = false;
  // Break the actual Realtime socket, then permit a fresh real subscription. No app state mocks.
  await socket!.close({ code: 1012, reason: 'integration reconnect' });
  await serverSocket!.close();
  await expect(guest.getByRole('heading', { name: 'Game Over!', exact: true })).toBeVisible({ timeout: 25_000 });
  for (const page of [host, guest]) await expect(page.locator('p').filter({ hasText: /^1$/ })).toHaveCount(2);
  await Promise.all([host.context().close(), guest.context().close()]);
});
