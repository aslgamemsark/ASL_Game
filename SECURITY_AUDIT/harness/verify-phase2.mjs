import { freshDb, as, admin } from './db.mjs';
import { seed } from './fixtures.mjs';

const P = (b) => b ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
let fails = 0;
const check = (label, cond, detail = '') => {
  if (!cond) fails++;
  console.log("  " + P(cond) + "  " + label + (detail ? "   (" + detail + ")" : ""));
};

const { db } = await freshDb();
const ids = await seed(db);
const bob    = { role: 'authenticated', uid: ids.bob };
const alice  = { role: 'authenticated', uid: ids.alice };
const banned = { role: 'authenticated', uid: ids.banned };
const adminU = { role: 'authenticated', uid: ids.adminUser };
const anon   = { role: 'anon', uid: null };

// ── F-008: ban enforcement ────────────────────────────────────────────────────────────────────
console.log("\n=== F-008 ban enforcement (must block banned, must NOT block normal users) ===");

const banRoom = await as(db, banned,
  "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('BANNED1','duel','public','" + ids.banned + "',2)");
const banRoomRows = await admin(db, "select count(*)::int as n from public.multiplayer_rooms where code='BANNED1'");
check("banned user CANNOT create a room", banRoomRows[0].n === 0);

const okRoom = await as(db, alice,
  "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('GOOD01','duel','private','" + ids.alice + "',2)");
const okRoomRows = await admin(db, "select count(*)::int as n from public.multiplayer_rooms where code='GOOD01'");
check("NORMAL user CAN still create a room (no over-tightening)", okRoomRows[0].n === 1, okRoom.error || '');

const bobJoin = await as(db, bob, "select public.join_multiplayer_room('GOOD01')");
const bobMember = await admin(db, "select count(*)::int as n from public.multiplayer_room_members where room_code='GOOD01' and user_id=$1", [ids.bob]);
check("NORMAL user CAN still join by code", bobJoin.ok && bobMember[0].n === 1, bobJoin.error || '');

const banJoin = await as(db, banned, "select public.join_multiplayer_room('GOOD01')");
check("banned user CANNOT join a room", !banJoin.ok, banJoin.error || 'JOIN SUCCEEDED');

// Matchmaking: normal user finds a public room; banned user finds nothing.
await admin(db, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants,status) values ('PUBM01','duel','public',$1,2,'waiting')", [ids.alice]);
const goodMatch = await as(db, adminU, "select * from public.find_public_room('duel')");
check("NORMAL user matchmaking still returns a room", goodMatch.ok && goodMatch.rows.length === 1 && goodMatch.rows[0].code, goodMatch.error || '');
const banMatch = await as(db, banned, "select * from public.find_public_room('duel')");
const banGotRoom = banMatch.ok && banMatch.rows.length === 1 && banMatch.rows[0].code !== null;
check("banned user matchmaking returns nothing", !banGotRoom);

const banFeedback = await as(db, banned, "insert into public.feedback (user_id,category,message,anonymous) values ('" + ids.banned + "','bug','x',false)");
const bfRows = await admin(db, "select count(*)::int as n from public.feedback where user_id=$1", [ids.banned]);
check("banned user CANNOT submit feedback", bfRows[0].n === 0);
const okFeedback = await as(db, bob, "insert into public.feedback (user_id,category,message,anonymous) values ('" + ids.bob + "','bug','legit',false)");
const okFb = await admin(db, "select count(*)::int as n from public.feedback where user_id=$1", [ids.bob]);
check("NORMAL user CAN still submit feedback", okFb[0].n === 1, okFeedback.error || '');

const banReport = await as(db, banned, "insert into public.user_reports (reporter_id,reported_id,reason) values ('" + ids.banned + "','" + ids.alice + "','spam')");
const brRows = await admin(db, "select count(*)::int as n from public.user_reports where reporter_id=$1", [ids.banned]);
check("banned user CANNOT file reports", brRows[0].n === 0);
const okReport = await as(db, bob, "insert into public.user_reports (reporter_id,reported_id,reason) values ('" + ids.bob + "','" + ids.alice + "','spam')");
const orRows = await admin(db, "select count(*)::int as n from public.user_reports where reporter_id=$1", [ids.bob]);
check("NORMAL user CAN still file a report", orRows[0].n === 1, okReport.error || '');

// A banned host must still be able to tear down a room they own (must not be trapped).
await admin(db, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('BANOWN','duel','private',$1,2)", [ids.banned]);
await as(db, banned, "delete from public.multiplayer_rooms where code='BANOWN'");
const banOwnGone = await admin(db, "select count(*)::int as n from public.multiplayer_rooms where code='BANOWN'");
check("banned host CAN still delete their own room (not trapped)", banOwnGone[0].n === 0);

// ── F-003: profile exposure ───────────────────────────────────────────────────────────────────
console.log("\n=== F-003 profile exposure (moderation/privilege columns must not leak) ===");

const anonProfiles = await as(db, anon, "select * from public.profiles");
check("anon CANNOT read the profiles base table", (anonProfiles.rows?.length ?? 0) === 0, "rows=" + (anonProfiles.rows?.length ?? 0));

const bobReadsAlice = await as(db, bob, "select is_admin, is_banned, ban_reason from public.profiles where id='" + ids.alice + "'");
check("authenticated user CANNOT read another user's privilege/moderation columns",
  (bobReadsAlice.rows?.length ?? 0) === 0, "rows=" + (bobReadsAlice.rows?.length ?? 0));

const bobSelf = await as(db, bob, "select username, is_admin, is_banned, ban_reason from public.profiles where id='" + ids.bob + "'");
check("user CAN still read their OWN profile flags (AuthContext depends on this)",
  (bobSelf.rows?.length ?? 0) === 1, bobSelf.error || '');

const adminReads = await as(db, adminU, "select count(*)::int as n from public.profiles");
check("admin CAN still read all profiles (moderation panel)", (adminReads.rows?.[0]?.n ?? 0) === 4, "n=" + (adminReads.rows?.[0]?.n ?? 0));

const anonView = await as(db, anon, "select * from public.public_profiles");
check("anon CAN read public_profiles (leaderboard/friends still work)", (anonView.rows?.length ?? 0) === 4, "rows=" + (anonView.rows?.length ?? 0));
const viewCols = anonView.rows?.[0] ? Object.keys(anonView.rows[0]) : [];
check("public_profiles exposes ONLY safe columns", !viewCols.some(c => ['is_admin','is_banned','ban_reason','collect_training_data'].includes(c)),
  "cols=" + viewCols.join(','));

const bobView = await as(db, bob, "select id, username from public.public_profiles where username='alice'");
check("authenticated user CAN look up another username (friends search)", (bobView.rows?.length ?? 0) === 1);

// ── Confirm F-001/F-002 still hold after Phase 2 changes ──────────────────────────────────────
console.log("\n=== Regression: F-001 / F-002 still fixed after Phase 2 ===");
const bobRoomRead = await as(db, bob, "select code from public.multiplayer_rooms where code='PUBM01'");
check("F-001: non-member still cannot read a room row", (bobRoomRead.rows?.length ?? 0) === 0);
await as(db, alice, "delete from public.user_progress where user_id='" + ids.alice + "'");
const progAlive = await admin(db, "select count(*)::int as n from public.user_progress where user_id=$1", [ids.alice]);
check("F-002: client still cannot delete progress row", progAlive[0].n === 1);
await admin(db, "delete from public.user_progress where user_id=$1", [ids.bob]);
await as(db, bob, "insert into public.user_progress (user_id,gold,xp) values ('" + ids.bob + "',99000000,99000000)");
const capped = await admin(db, "select gold from public.user_progress where user_id=$1", [ids.bob]);
check("F-002: INSERT still capped", Number(capped[0]?.gold) <= 20000, "gold=" + capped[0]?.gold);

console.log("\n" + (fails === 0 ? "\x1b[32mALL PHASE 2 CHECKS PASSED\x1b[0m" : "\x1b[31m" + fails + " CHECK(S) FAILED\x1b[0m"));
await db.close();
process.exit(fails === 0 ? 0 : 1);
