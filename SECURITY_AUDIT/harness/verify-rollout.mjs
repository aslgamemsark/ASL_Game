import { freshDb, as, admin } from './db.mjs';
import { seed } from './fixtures.mjs';

// Production passes through THREE states during this rollout, not one. A fix that is only correct
// in the final state still breaks users in the middle. This exercises every state.
//
//   STATE 1  migration A applied, OLD client still deployed   (between step 1 and step 2)
//   STATE 2  migration A applied, NEW client deployed          (between step 2 and step 3)
//   STATE 3  A + B applied, NEW client deployed                (final)
const P = (b) => b ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
let fails = 0;
const check = (l, c, d = '') => { if (!c) fails++; console.log("  " + P(c) + "  " + l + (d ? "   (" + d + ")" : "")); };

const MIG_B = '20260901190000';

async function state(label, exclude) {
  console.log("\n=== " + label + " ===");
  const { db } = await freshDb({ excludeMigrations: exclude });
  const ids = await seed(db);
  const bob = { role: 'authenticated', uid: ids.bob };
  const anon = { role: 'anon', uid: null };
  const adminU = { role: 'authenticated', uid: ids.adminUser };
  return { db, ids, bob, anon, adminU };
}

// ── STATE 1: migration A only, OLD client (reads profiles cross-user) ─────────────────────────
{
  const { db, ids, bob, anon, adminU } = await state("STATE 1 — migration A applied, OLD client still live", [MIG_B]);

  // The old client's cross-user reads MUST still work, or a stale browser tab breaks.
  const oldFriends = await as(db, bob, "select id, username from public.profiles where id='" + ids.alice + "'");
  check("OLD client: cross-user username lookup still works (friends/leaderboard)",
    (oldFriends.rows?.length ?? 0) === 1, "rows=" + (oldFriends.rows?.length ?? 0));

  const oldUnique = await as(db, anon, "select id from public.profiles where username='alice'");
  check("OLD client: username-uniqueness check still works", (oldUnique.rows?.length ?? 0) === 1);

  // F-008 must ALREADY be fixed at this point -- the security win lands in step 1, not step 3.
  await admin(db, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('S1ROOM','duel','private',$1,2)", [ids.alice]);
  const banned = { role: 'authenticated', uid: ids.banned };
  const banJoin = await as(db, banned, "select public.join_multiplayer_room('S1ROOM')");
  check("F-008 already fixed in STATE 1 (banned cannot join)", !banJoin.ok, banJoin.error || 'JOIN SUCCEEDED');
  await as(db, banned, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('S1BAN','duel','public','" + ids.banned + "',2)");
  const banRoom = await admin(db, "select count(*)::int as n from public.multiplayer_rooms where code='S1BAN'");
  check("F-008 already fixed in STATE 1 (banned cannot host)", banRoom[0].n === 0);

  // The view exists already, so the NEW client would also work here.
  const view = await as(db, anon, "select id, username from public.public_profiles");
  check("public_profiles ALREADY exists (new client would work too)", (view.rows?.length ?? 0) === 4);

  await db.close();
}

// ── STATE 2: migration A only, NEW client (reads public_profiles) ─────────────────────────────
{
  const { db, ids, bob, anon } = await state("STATE 2 — migration A applied, NEW client deployed", [MIG_B]);
  const v = await as(db, bob, "select id, username from public.public_profiles where id='" + ids.alice + "'");
  check("NEW client: cross-user lookup via public_profiles works", (v.rows?.length ?? 0) === 1);
  const u = await as(db, anon, "select id from public.public_profiles where username='alice'");
  check("NEW client: username-uniqueness check works", (u.rows?.length ?? 0) === 1);
  const self = await as(db, bob, "select username, is_admin, is_banned from public.profiles where id='" + ids.bob + "'");
  check("NEW client: self profile-flag read works", (self.rows?.length ?? 0) === 1);
  await db.close();
}

// ── STATE 3: A + B, NEW client — the final, fully-hardened state ──────────────────────────────
{
  const { db, ids, bob, anon, adminU } = await state("STATE 3 — A + B applied, NEW client (final)", []);
  const leak = await as(db, anon, "select * from public.profiles");
  check("F-003 fixed: anon cannot read profiles base table", (leak.rows?.length ?? 0) === 0);
  const cross = await as(db, bob, "select is_admin, ban_reason from public.profiles where id='" + ids.alice + "'");
  check("F-003 fixed: cross-user privilege/moderation columns hidden", (cross.rows?.length ?? 0) === 0);
  const v = await as(db, bob, "select id, username from public.public_profiles where id='" + ids.alice + "'");
  check("NEW client still works: public_profiles lookup", (v.rows?.length ?? 0) === 1);
  const self = await as(db, bob, "select is_admin from public.profiles where id='" + ids.bob + "'");
  check("NEW client still works: self flag read", (self.rows?.length ?? 0) === 1);
  const adm = await as(db, adminU, "select count(*)::int as n from public.profiles");
  check("admin moderation panel still works", (adm.rows?.[0]?.n ?? 0) === 4);
  await db.close();
}

// ── The hazard this split exists to prevent ───────────────────────────────────────────────────
{
  console.log("\n=== HAZARD CHECK — what step 3 would do to a stale tab (why B is deferred) ===");
  const { db, ids, bob } = await state("  (A+B applied, simulating an OLD client's query)", []);
  const stale = await as(db, bob, "select id, username from public.profiles where id='" + ids.alice + "'");
  const degraded = (stale.rows?.length ?? 0) === 0;
  console.log("  " + (degraded ? "\x1b[33mCONFIRMED\x1b[0m" : "\x1b[32mno impact\x1b[0m") +
    "  an OLD-bundle tab reads 0 rows cross-user once B is applied" +
    (degraded ? "  <- exactly why B ships separately, after clients roll over" : ""));
  await db.close();
}

console.log("\n" + (fails === 0 ? "\x1b[32mALL ROLLOUT STATES SAFE\x1b[0m" : "\x1b[31m" + fails + " CHECK(S) FAILED\x1b[0m"));
process.exit(fails === 0 ? 0 : 1);
