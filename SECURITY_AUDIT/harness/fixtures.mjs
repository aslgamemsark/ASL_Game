import { admin } from './db.mjs';

/** Synthetic identities. Mirrors the personas the audit brief requires. */
export async function seed(db) {
  const ids = {};
  for (const [k, email] of Object.entries({
    alice: 'alice@test.local', bob: 'bob@test.local',
    adminUser: 'admin@test.local', banned: 'banned@test.local',
  })) {
    const r = await admin(db, `insert into auth.users (email) values ($1) returning id`, [email]);
    ids[k] = r[0].id;
  }
  // handle_new_user() fires on auth.users insert and creates profiles + user_progress rows.
  await admin(db, `update public.profiles set is_admin = true where id = $1`, [ids.adminUser]);
  await admin(db, `update public.profiles set is_banned = true, ban_reason = 'INTERNAL MOD NOTE: test' where id = $1`, [ids.banned]);
  return ids;
}
