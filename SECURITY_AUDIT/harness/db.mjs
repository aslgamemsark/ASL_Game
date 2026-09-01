import { PGlite } from '../../web/node_modules/@electric-sql/pglite/dist/index.js';
import { BOOTSTRAP } from './bootstrap.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG_DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));

/** Applies every repo migration in filename order, as supabase_admin (like `supabase db reset`). */
export async function freshDb({ quiet = true, excludeMigrations = [] } = {}) {
  const db = await PGlite.create();
  await db.exec(BOOTSTRAP);

  const files = fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql'))
    .filter(f => !excludeMigrations.some(x => f.includes(x))).sort();
  const applied = [], skipped = [];
  for (const f of files) {
    let sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
    // Harness-only substitution (never written back to the repo): PGlite has no pg_cron, so the
    // `create extension` line aborts otherwise-in-scope migrations. cron.schedule() itself is
    // shimmed in bootstrap.mjs. Only the extension declaration is neutralised; every policy,
    // function, trigger and grant in these files is applied verbatim and is what gets tested.
    sql = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi,
                      '-- [harness] pg_cron extension stubbed');
    try {
      await db.exec(sql);
      applied.push(f);
    } catch (e) {
      skipped.push({ f, err: e.message.split('\n')[0] });
      if (!quiet) console.log(`  SKIP ${f}: ${e.message.split('\n')[0]}`);
    }
  }
  return { db, applied, skipped };
}

/** Run SQL as a given Supabase role + identity, exactly as PostgREST would. */
export async function as(db, { role = 'anon', uid = null }, sql, params = []) {
  const claims = uid ? JSON.stringify({ sub: uid, role }) : JSON.stringify({ role });
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec(`set local role ${role}`);
    const r = params.length ? await db.query(sql, params) : await db.query(sql);
    await db.exec('commit');
    return { ok: true, rows: r.rows, count: r.rows?.length ?? 0 };
  } catch (e) {
    try { await db.exec('rollback'); } catch {}
    return { ok: false, error: e.message.split('\n')[0] };
  }
}

/** Privileged helper (bypasses RLS) for fixtures + ground-truth assertions. */
export async function admin(db, sql, params = []) {
  const r = params.length ? await db.query(sql, params) : await db.query(sql);
  return r.rows;
}
