import { freshDb, as, admin } from './db.mjs';
import { seed } from './fixtures.mjs';

const RED = (s) => "\x1b[31m" + s + "\x1b[0m";
const GRN = (s) => "\x1b[32m" + s + "\x1b[0m";

const { db } = await freshDb();
const ids = await seed(db);

// ── Realtime authorization ────────────────────────────────────────────────────────────────────
// realtime.messages carries the challenge + room signalling that precedes every WebRTC
// connection. Its policies are the last gate before two browsers exchange SDP/ICE and then
// camera tracks, so an over-broad policy here is a webcam-exposure issue, not a messaging one.
console.log("\n=== REALTIME: challenge topic authorization ===");
async function rt(ctx, topic, sql) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ctx.uid, role: ctx.role })]);
    await db.query("select set_config('realtime.topic', $1, true)", [topic]);
    await db.exec("set local role " + ctx.role);
    const r = await db.query(sql);
    await db.exec('commit');
    return { ok: true, rows: r.rows };
  } catch (e) { try { await db.exec('rollback'); } catch {} return { ok: false, error: e.message.split('\n')[0] }; }
}

const bob = { role: 'authenticated', uid: ids.bob };
const alice = { role: 'authenticated', uid: ids.alice };

await admin(db, "insert into realtime.messages (topic,extension,payload) values ($1,'broadcast','{}'::jsonb)",
  ["challenge_" + ids.alice]);

const bobReadsAlice = await rt(bob, "challenge_" + ids.alice, "select * from realtime.messages");
console.log("  bob reads ALICE's challenge topic: " +
  (bobReadsAlice.ok && bobReadsAlice.rows.length ? RED("LEAK (" + bobReadsAlice.rows.length + " rows)") : GRN("blocked")));

const aliceReadsOwn = await rt(alice, "challenge_" + ids.alice, "select * from realtime.messages");
console.log("  alice reads OWN challenge topic:   " +
  (aliceReadsOwn.ok && aliceReadsOwn.rows.length ? GRN("allowed (correct)") : RED("BROKEN - own topic denied")));

console.log("\n=== REALTIME: room topic authorization ===");
await admin(db, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('RTROOM','duel','private',$1,2)", [ids.alice]);
await admin(db, "insert into realtime.messages (topic,extension,payload) values ('mp-room-RTROOM','broadcast','{}'::jsonb)");

const nonMember = await rt(bob, "mp-room-RTROOM", "select * from realtime.messages where topic='mp-room-RTROOM'");
console.log("  NON-MEMBER bob reads room topic:   " +
  (nonMember.ok && nonMember.rows.length ? RED("LEAK") : GRN("blocked")));

await admin(db, "insert into public.multiplayer_room_members (room_code,user_id) values ('RTROOM',$1) on conflict do nothing", [ids.bob]);
const member = await rt(bob, "mp-room-RTROOM", "select * from realtime.messages where topic='mp-room-RTROOM'");
console.log("  MEMBER bob reads room topic:       " +
  (member.ok && member.rows.length ? GRN("allowed (correct)") : "blocked (topic-format dependent)"));

// Membership revocation: after leaving, signalling access must stop.
await admin(db, "delete from public.multiplayer_room_members where room_code='RTROOM' and user_id=$1", [ids.bob]);
const afterLeave = await rt(bob, "mp-room-RTROOM", "select * from realtime.messages where topic='mp-room-RTROOM'");
console.log("  EX-MEMBER (left room) reads topic:  " +
  (afterLeave.ok && afterLeave.rows.length ? RED("LEAK - revocation broken") : GRN("blocked (revocation works)")));

// ── Economy race condition ────────────────────────────────────────────────────────────────────
// guard_progress_deltas caps PER STATEMENT. Concurrent statements each get their own cap, so the
// question is whether N parallel writes can compound beyond one ceiling (TOCTOU / double-credit).
console.log("\n=== ECONOMY: concurrent write race (10 parallel capped updates) ===");
await admin(db, "update public.user_progress set gold=0 where user_id=$1", [ids.alice]);
const before = (await admin(db, "select gold from public.user_progress where user_id=$1", [ids.alice]))[0].gold;
await Promise.all(Array.from({ length: 10 }, () =>
  as(db, alice, "update public.user_progress set gold = gold + 19999 where user_id='" + ids.alice + "'")));
const after = (await admin(db, "select gold from public.user_progress where user_id=$1", [ids.alice]))[0].gold;
console.log("  gold " + before + " -> " + after + "  (single-write ceiling = 20000)");
console.log("  " + (Number(after) > 20000
  ? RED("compounding possible: repeated capped writes accumulate")
  : GRN("no single-write bypass")));
console.log("  NOTE: capping is per-write by design; nothing limits the NUMBER of writes (F-004).");

// ── Room capacity race ────────────────────────────────────────────────────────────────────────
console.log("\n=== MULTIPLAYER: room capacity race (parallel joins on a 2-seat room) ===");
await admin(db, "delete from public.multiplayer_rooms where code='CAPRACE'");
await admin(db, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants,status) values ('CAPRACE','duel','public',$1,2,'waiting')", [ids.alice]);
const joiners = [ids.bob, ids.adminUser, ids.banned];
await Promise.all(joiners.map(u =>
  as(db, { role: 'authenticated', uid: u }, "select public.join_multiplayer_room('CAPRACE')")));
const seats = (await admin(db, "select participant_count from public.multiplayer_rooms where code='CAPRACE'"))[0];
const members = (await admin(db, "select count(*)::int as n from public.multiplayer_room_members where room_code='CAPRACE'"))[0];
console.log("  participant_count=" + seats.participant_count + "  members=" + members.n + "  max=2");
console.log("  " + (members.n > 2 ? RED("OVERSUBSCRIBED - capacity race") : GRN("capacity respected")));

await db.close();
