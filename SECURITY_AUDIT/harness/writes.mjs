import { freshDb, as, admin } from './db.mjs';
import { seed } from './fixtures.mjs';

// An UPDATE/DELETE that RLS filters down to zero rows raises NO error -- it simply affects
// nothing. Grading on "did the statement throw" therefore reports a wall of false positives.
// Every probe below is graded on OBSERVED STATE CHANGE, read back with the service role.
const RED = (s) => "\x1b[31m" + s + "\x1b[0m";
const GRN = (s) => "\x1b[32m" + s + "\x1b[0m";
const YEL = (s) => "\x1b[33m" + s + "\x1b[0m";

const { db } = await freshDb();
const ids = await seed(db);
const findings = [];

async function probe(label, ctx, sql, verify, expectBlocked = true) {
  const before = await verify();
  await as(db, ctx, sql);
  const after = await verify();
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  const bad = expectBlocked ? changed : !changed;
  if (bad && expectBlocked) findings.push(label);
  const tag = changed ? (expectBlocked ? RED("CHANGED") : GRN("changed")) : (expectBlocked ? GRN("no-op  ") : RED("BLOCKED"));
  console.log("  " + tag + "  " + label + "   " + JSON.stringify(before) + " -> " + JSON.stringify(after));
}

const bob    = { role: 'authenticated', uid: ids.bob };
const banned = { role: 'authenticated', uid: ids.banned };
const anon   = { role: 'anon', uid: null };

const q1 = (sql, p) => async () => (await admin(db, sql, p))[0] ?? null;

await admin(db, "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('AROOM1','duel','private',$1,2)", [ids.alice]);
await admin(db, "insert into public.friendships (requester_id,addressee_id,status) values ($1,$2,'pending')", [ids.alice, ids.adminUser]);
await admin(db, "insert into public.user_reports (reporter_id,reported_id,reason) values ($1,$2,'offensive')", [ids.alice, ids.bob]);
await admin(db, "insert into public.feedback (user_id,category,message,anonymous) values ($1,'bug','alice feedback',false)", [ids.alice]);
await admin(db, "insert into public.world_flags (world_id,enabled) values ('w1',true) on conflict do nothing");

console.log("\n=== CROSS-USER WRITES (bob -> alice) — graded on real state change ===");
await probe("UPDATE alice profile.username", bob,
  "update public.profiles set username='pwned' where id='" + ids.alice + "'",
  q1("select username from public.profiles where id=$1", [ids.alice]));
await probe("DELETE alice progress row", bob,
  "delete from public.user_progress where user_id='" + ids.alice + "'",
  q1("select count(*)::int as n from public.user_progress where user_id=$1", [ids.alice]));
await probe("UPDATE alice gold", bob,
  "update public.user_progress set gold=99999 where user_id='" + ids.alice + "'",
  q1("select gold from public.user_progress where user_id=$1", [ids.alice]));
await probe("UPDATE alice friendship status", bob,
  "update public.friendships set status='accepted' where requester_id='" + ids.alice + "'",
  q1("select status from public.friendships where requester_id=$1", [ids.alice]));
await probe("DELETE alice friendship", bob,
  "delete from public.friendships where requester_id='" + ids.alice + "'",
  q1("select count(*)::int as n from public.friendships where requester_id=$1", [ids.alice]));
await probe("DELETE alice room", bob,
  "delete from public.multiplayer_rooms where code='AROOM1'",
  q1("select count(*)::int as n from public.multiplayer_rooms where code='AROOM1'"));
await probe("HIJACK alice room (set host_id=bob)", bob,
  "update public.multiplayer_rooms set host_id='" + ids.bob + "' where code='AROOM1'",
  q1("select host_id from public.multiplayer_rooms where code='AROOM1'"));
await probe("UPDATE alice report reason", bob,
  "update public.user_reports set reason='spam' where reporter_id='" + ids.alice + "'",
  q1("select reason from public.user_reports where reporter_id=$1", [ids.alice]));
await probe("UPDATE alice feedback text", bob,
  "update public.feedback set message='pwned' where user_id='" + ids.alice + "'",
  q1("select message from public.feedback where user_id=$1", [ids.alice]));
await probe("UPDATE world_flags (feature flags)", bob,
  "update public.world_flags set enabled=false where world_id='w1'",
  q1("select enabled from public.world_flags where world_id='w1'"));

console.log("\n=== PRIVILEGE ESCALATION — graded on real state change ===");
await probe("bob self -> is_admin", bob,
  "update public.profiles set is_admin=true where id='" + ids.bob + "'",
  q1("select is_admin from public.profiles where id=$1", [ids.bob]));
await probe("BANNED user unbans SELF", banned,
  "update public.profiles set is_banned=false where id='" + ids.banned + "'",
  q1("select is_banned from public.profiles where id=$1", [ids.banned]));
await probe("BANNED user clears own ban_reason", banned,
  "update public.profiles set ban_reason=null where id='" + ids.banned + "'",
  q1("select ban_reason from public.profiles where id=$1", [ids.banned]));
await probe("bob bans alice", bob,
  "update public.profiles set is_banned=true where id='" + ids.alice + "'",
  q1("select is_banned from public.profiles where id=$1", [ids.alice]));
await probe("bob edits alice moderation note", bob,
  "update public.profiles set ban_reason='cleared' where id='" + ids.alice + "'",
  q1("select ban_reason from public.profiles where id=$1", [ids.alice]));

console.log("\n=== BANNED USER — can a banned account still act? ===");
await probe("banned writes own progress", banned,
  "update public.user_progress set gold=555 where user_id='" + ids.banned + "'",
  q1("select gold from public.user_progress where user_id=$1", [ids.banned]));
await probe("banned CREATES a multiplayer room", banned,
  "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('BAN001','duel','public','" + ids.banned + "',2)",
  q1("select count(*)::int as n from public.multiplayer_rooms where code='BAN001'"));
await probe("banned submits feedback", banned,
  "insert into public.feedback (user_id,category,message,anonymous) values ('" + ids.banned + "','bug','x',false)",
  q1("select count(*)::int as n from public.feedback where user_id=$1", [ids.banned]));
await probe("banned files a user report", banned,
  "insert into public.user_reports (reporter_id,reported_id,reason) values ('" + ids.banned + "','" + ids.alice + "','spam')",
  q1("select count(*)::int as n from public.user_reports where reporter_id=$1", [ids.banned]));

console.log("\n=== banned user via RPC ===");
const j = await as(db, banned, "select public.join_multiplayer_room('AROOM1')");
console.log("  join_multiplayer_room as BANNED: " + (j.ok ? RED("ALLOWED") : GRN("denied")) + (j.ok ? "" : "  (" + String(j.error).slice(0,60) + ")"));
const memAfter = await admin(db, "select count(*)::int as n from public.multiplayer_room_members where room_code='AROOM1' and user_id=$1", [ids.banned]);
console.log("  -> banned user is now a member of AROOM1? " + (memAfter[0].n > 0 ? RED("YES") : GRN("no")));

console.log("\n=== ANON writes ===");
await probe("anon inserts a profile", anon,
  "insert into public.profiles (id,username) values (gen_random_uuid(),'anonprofile')",
  q1("select count(*)::int as n from public.profiles where username='anonprofile'"));
await probe("anon writes progress", anon,
  "update public.user_progress set gold=1 where user_id='" + ids.alice + "'",
  q1("select gold from public.user_progress where user_id=$1", [ids.alice]));

console.log("\n" + (findings.length ? RED("REAL STATE CHANGES ACHIEVED BY ATTACKER: " + findings.length) : GRN("No unauthorized state change achieved")));
findings.forEach(f => console.log("   -> " + f));
await db.close();
