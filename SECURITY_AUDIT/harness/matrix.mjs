import { freshDb, as, admin } from './db.mjs';
import { seed } from './fixtures.mjs';

const RED = (s) => "\x1b[31m" + s + "\x1b[0m";
const GRN = (s) => "\x1b[32m" + s + "\x1b[0m";
const YEL = (s) => "\x1b[33m" + s + "\x1b[0m";
const mark = (allowed) => allowed ? RED("ALLOWED") : GRN("denied ");

const { db } = await freshDb();
const ids = await seed(db);

// Fixtures are best-effort: a CHECK-constraint mismatch on one table must not abort the whole
// matrix, and a table that ends up with 0 rows simply yields a weaker (never a false-negative)
// read signal for that row of the matrix.
const fixture = async (label, sql, params) => {
  try { await admin(db, sql, params); }
  catch (e) { console.log("  [fixture skipped] " + label + ": " + String(e.message).slice(0,80)); }
};
await fixture("room",      "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('AROOM1','duel','private',$1,2)", [ids.alice]);
await fixture("attempt",   "insert into public.sign_attempts (user_id,sign_id,passed) values ($1,'LETTER_A',true)", [ids.alice]);
await fixture("friendship","insert into public.friendships (requester_id,addressee_id,status) values ($1,$2,'pending')", [ids.alice, ids.adminUser]);
await fixture("report",    "insert into public.user_reports (reporter_id,reported_id,reason) values ($1,$2,'offensive')", [ids.alice, ids.bob]);
await fixture("feedback",  "insert into public.feedback (user_id,category,message,anonymous) values ($1,'bug','alice private feedback',false)", [ids.alice]);

const TABLES = ['profiles','user_progress','sign_attempts','training_samples','sign_verification_log',
  'friendships','multiplayer_rooms','multiplayer_room_members','room_join_attempts','feedback',
  'user_reports','world_flags','audit_logs','admin_audit_log'];

const ROLES = {
  anon:   { role:'anon',          uid:null },
  bob:    { role:'authenticated', uid:ids.bob },
  banned: { role:'authenticated', uid:ids.banned },
  admin:  { role:'authenticated', uid:ids.adminUser },
};

console.log("\n=== READ MATRIX: rows visible per role (fixtures are ALICE-owned) ===");
console.log("table                          anon    bob banned  admin");
const anonReadable = [];
for (const t of TABLES) {
  const out = [];
  for (const ctx of Object.values(ROLES)) {
    const r = await as(db, ctx, "select * from public." + t);
    out.push(r.ok ? String(r.rows.length) : "ERR");
  }
  console.log(t.padEnd(28) + " " + out.map(x => x.padStart(6)).join(" "));
  if (out[0] !== "0" && out[0] !== "ERR") anonReadable.push(t + " (" + out[0] + " rows)");
}
console.log("\n--- anon-readable tables ---");
anonReadable.forEach(l => console.log("   " + l));

console.log("\n=== VIEWS reachable by anon ===");
const views = await admin(db, "select table_name from information_schema.views where table_schema='public'");
for (const v of views) {
  const r = await as(db, ROLES.anon, "select * from public." + v.table_name + " limit 3");
  console.log("  " + v.table_name.padEnd(26) + " anon: " + (r.ok ? r.rows.length + " rows" : "DENIED"));
  if (r.ok && r.rows.length) console.log("      cols: " + Object.keys(r.rows[0]).join(", "));
}

console.log("\n=== CROSS-USER WRITE (bob -> alice) ===");
const writes = [
  ["UPDATE alice profile",       "update public.profiles set username='pwned' where id='" + ids.alice + "'"],
  ["DELETE alice progress",      "delete from public.user_progress where user_id='" + ids.alice + "'"],
  ["UPDATE alice progress",      "update public.user_progress set gold=99999 where user_id='" + ids.alice + "'"],
  ["DELETE alice attempts",      "delete from public.sign_attempts where user_id='" + ids.alice + "'"],
  ["DELETE alice friendship",    "delete from public.friendships where requester_id='" + ids.alice + "'"],
  ["UPDATE alice friendship",    "update public.friendships set status='accepted' where requester_id='" + ids.alice + "'"],
  ["DELETE alice room",          "delete from public.multiplayer_rooms where code='AROOM1'"],
  ["UPDATE alice room host",     "update public.multiplayer_rooms set host_id='" + ids.bob + "' where code='AROOM1'"],
  ["INSERT self into alice room","insert into public.multiplayer_room_members (room_code,user_id) values ('AROOM1','" + ids.bob + "')"],
  ["UPDATE alice report",        "update public.user_reports set reason='x' where reporter_id='" + ids.alice + "'"],
  ["UPDATE alice feedback",      "update public.feedback set message='x' where user_id='" + ids.alice + "'"],
  ["INSERT admin_audit_log",     "insert into public.admin_audit_log (admin_id,action) values ('" + ids.bob + "','fake')"],
  ["UPDATE world_flags",         "update public.world_flags set enabled=false"],
];
for (const [label, sql] of writes) {
  const r = await as(db, ROLES.bob, sql);
  console.log("  " + mark(r.ok) + "  " + label + (r.ok ? "" : "  (" + String(r.error).slice(0,55) + ")"));
}

console.log("\n=== PRIVILEGE ESCALATION (bob) ===");
for (const [label, sql] of [
  ["self -> is_admin",     "update public.profiles set is_admin=true where id='" + ids.bob + "'"],
  ["self -> unban",        "update public.profiles set is_banned=false where id='" + ids.bob + "'"],
  ["ban another user",     "update public.profiles set is_banned=true where id='" + ids.alice + "'"],
  ["edit moderation note", "update public.profiles set ban_reason='cleared' where id='" + ids.alice + "'"],
]) {
  const r = await as(db, ROLES.bob, sql);
  console.log("  " + mark(r.ok) + "  " + label);
}
const bf = await admin(db, "select is_admin from public.profiles where id='" + ids.bob + "'");
console.log("  -> bob.is_admin final = " + bf[0].is_admin);

console.log("\n=== ADMIN RPCs called by NON-ADMIN (bob) ===");
const rpcs = [
  "select public.admin_grant_gold('" + ids.bob + "'::uuid, 100000, 'x')",
  "select public.admin_set_ban('" + ids.alice + "'::uuid, true, 'x')",
  "select public.admin_set_cosmetic('" + ids.bob + "'::uuid, 'avatar', 'gold')",
  "select public.admin_grant_cosmetics('" + ids.bob + "'::uuid, array['a','b'])",
  "select public.admin_get_user_progress('" + ids.alice + "'::uuid)",
  "select public.admin_set_username('" + ids.alice + "'::uuid, 'pwned')",
  "select public.admin_set_world_flag('w1', true, true)",
  "select public.admin_beta_metrics()",
  "select public.admin_analytics(7)",
];
for (const sql of rpcs) {
  const r = await as(db, ROLES.bob, sql);
  console.log("  " + mark(r.ok) + "  " + sql.match(/public\.(\w+)/)[1]);
}

console.log("\n=== ADMIN RPCs called by ANON ===");
for (const sql of rpcs.slice(0, 4)) {
  const r = await as(db, ROLES.anon, sql);
  console.log("  " + mark(r.ok) + "  " + sql.match(/public\.(\w+)/)[1]);
}

console.log("\n=== TRIGGER FUNCTIONS callable directly by bob? ===");
for (const fn of ["guard_progress_deltas","handle_new_user","protect_privileged_profile_columns",
                  "guard_progress_insert","add_host_to_room_members","trim_training_samples",
                  "cleanup_stale_multiplayer_rooms"]) {
  const r = await as(db, ROLES.bob, "select public." + fn + "()");
  console.log("  " + mark(r.ok) + "  " + fn);
}

console.log("\n=== BANNED USER still able to act? ===");
for (const [label, sql] of [
  ["write progress",  "update public.user_progress set gold=100 where user_id='" + ids.banned + "'"],
  ["log sign attempt","insert into public.sign_attempts (user_id,sign_id,passed) values ('" + ids.banned + "','A',true)"],
  ["create room",     "insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants) values ('BAN001','duel','public','" + ids.banned + "',2)"],
  ["send friend req", "insert into public.friendships (requester_id,addressee_id,status) values ('" + ids.banned + "','" + ids.alice + "','pending')"],
  ["join room rpc",   "select public.join_multiplayer_room('AROOM1')"],
]) {
  const r = await as(db, ROLES.banned, sql);
  console.log("  " + (r.ok ? YEL("ALLOWED") : GRN("denied ")) + "  " + label);
}

await db.close();
