import { freshDb, as, admin } from './db.mjs';
import { seed } from './fixtures.mjs';

const FIX = '20260901120000';
const P = (b) => b ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
let fails = 0;
const check = (label, cond, detail='') => { if(!cond) fails++; console.log(`  ${P(cond)}  ${label}${detail?'  ('+detail+')':''}`); };

async function scenario(exclude) {
  const { db } = await freshDb({ excludeMigrations: exclude });
  const ids = await seed(db);
  return { db, ids };
}

// ───────────────────────── F-001 ─────────────────────────
async function f001(label, exclude, expectExploit) {
  console.log(`\n=== F-001 private room code exposure — ${label} ===`);
  const { db, ids } = await scenario(exclude);
  await admin(db, `insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants)
                   values ('PRIV01','duel','private',$1,2)`, [ids.alice]);

  const anonRead = await as(db, { role:'anon' }, `select code from public.multiplayer_rooms`);
  check('anon cannot enumerate rooms', (anonRead.rows?.length ?? 0) === 0, `rows=${anonRead.rows?.length ?? 0}`);

  const bobRead = await as(db, { role:'authenticated', uid: ids.bob },
    `select code from public.multiplayer_rooms where visibility='private'`);
  const bobSaw = (bobRead.rows?.length ?? 0) > 0;
  if (expectExploit) {
    check('EXPLOIT REPRODUCED: unrelated user reads private code', bobSaw, `rows=${bobRead.rows?.length}`);
  } else {
    check('unrelated user cannot read private room code', !bobSaw, `rows=${bobRead.rows?.length ?? 0}`);
  }

  const hostRead = await as(db, { role:'authenticated', uid: ids.alice },
    `select code from public.multiplayer_rooms where code='PRIV01'`);
  check('host can still read own room (no over-tightening)', (hostRead.rows?.length ?? 0) === 1);

  // Legit member: host trigger add_host_to_room_members put alice in; add bob as a real member.
  await admin(db, `insert into public.multiplayer_room_members (room_code,user_id) values ('PRIV01',$1)
                   on conflict do nothing`, [ids.bob]);
  const memberRead = await as(db, { role:'authenticated', uid: ids.bob },
    `select code from public.multiplayer_rooms where code='PRIV01'`);
  check('legitimate member CAN read room info', (memberRead.rows?.length ?? 0) === 1);

  // Public matchmaking must keep working (SECURITY DEFINER, bypasses RLS)
  await admin(db, `insert into public.multiplayer_rooms (code,mode,visibility,host_id,max_participants,status)
                   values ('PUB001','duel','public',$1,2,'waiting')`, [ids.alice]);
  const match = await as(db, { role:'authenticated', uid: ids.bob }, `select * from public.find_public_room('duel')`);
  check('public matchmaking still works', match.ok && (match.rows?.length ?? 0) === 1, match.error||'');

  await db.close();
}

// ───────────────────────── F-002 ─────────────────────────
async function f002(label, exclude, expectExploit) {
  console.log(`\n=== F-002 economy guard bypass — ${label} ===`);
  const { db, ids } = await scenario(exclude);

  const del = await as(db, { role:'authenticated', uid: ids.alice },
    `delete from public.user_progress where user_id=$1`, [ids.alice]);
  const left = await admin(db, `select gold from public.user_progress where user_id=$1`, [ids.alice]);
  const rowGone = left.length === 0;

  if (expectExploit) {
    check('EXPLOIT step 1: client CAN delete own progress row', rowGone);
    const ins = await as(db, { role:'authenticated', uid: ids.alice },
      `insert into public.user_progress (user_id,gold,xp,signs) values ($1,99000000,99000000,99000000)`, [ids.alice]);
    const after = await admin(db, `select gold,xp from public.user_progress where user_id=$1`, [ids.alice]);
    const minted = after[0] && Number(after[0].gold) > 100000;
    check('EXPLOIT step 2: arbitrary gold minted', !!minted, `gold=${after[0]?.gold} insErr=${ins.error||'none'}`);
  } else {
    check('client CANNOT delete own progress row', !rowGone, rowGone?'row deleted!':'row survived');
    // Force the INSERT path the guard protects (service role removes row; client re-inserts)
    await admin(db, `delete from public.user_progress where user_id=$1`, [ids.bob]);
    await as(db, { role:'authenticated', uid: ids.bob },
      `insert into public.user_progress (user_id,gold,xp,signs,rename_cards) values ($1,99000000,99000000,99000000,9999)`, [ids.bob]);
    const after = await admin(db, `select gold,xp,signs,rename_cards from public.user_progress where user_id=$1`, [ids.bob]);
    check('malicious INSERT is capped', after[0] && Number(after[0].gold) <= 20000, `gold=${after[0]?.gold}`);
    check('  xp capped', after[0] && Number(after[0].xp) <= 10000, `xp=${after[0]?.xp}`);
    check('  rename_cards capped', after[0] && Number(after[0].rename_cards) <= 20, `rc=${after[0]?.rename_cards}`);
  }

  // UPDATE path must remain capped in BOTH states -- the delta guard was never the broken part.
  // Deliberately run against a user whose row is still at its seeded baseline: in the pre-fix
  // scenario alice's row has already been re-inserted at 99M by the exploit above, so an UPDATE to
  // 99M is a zero delta and the trigger correctly does nothing. Asserting on her would measure the
  // test's own ordering, not the control.
  const updTarget = expectExploit ? ids.adminUser : ids.alice;
  const isAdminTarget = updTarget === ids.adminUser;
  if (!isAdminTarget) {
    await as(db, { role:'authenticated', uid: updTarget },
      `update public.user_progress set gold=99000000 where user_id=$1`, [updTarget]);
    const upd = await admin(db, `select gold from public.user_progress where user_id=$1`, [updTarget]);
    check('malicious UPDATE is capped', upd[0] && Number(upd[0].gold) <= 20000, `gold=${upd[0]?.gold}`);
  } else {
    // Pre-fix: use bob, untouched in this scenario (admins are intentionally exempt from the cap).
    await as(db, { role:'authenticated', uid: ids.bob },
      `update public.user_progress set gold=99000000 where user_id=$1`, [ids.bob]);
    const upd = await admin(db, `select gold from public.user_progress where user_id=$1`, [ids.bob]);
    check('malicious UPDATE is capped (delta guard was never the broken part)',
          upd[0] && Number(upd[0].gold) <= 20000, `gold=${upd[0]?.gold}`);
  }

  // Legit sync must still work (upsert with real values)
  const up = await as(db, { role:'authenticated', uid: ids.alice },
    `insert into public.user_progress (user_id,gold,xp) values ($1,150,300)
     on conflict (user_id) do update set gold=excluded.gold, xp=excluded.xp`, [ids.alice]);
  const synced = await admin(db, `select gold,xp from public.user_progress where user_id=$1`, [ids.alice]);
  check('legitimate progress sync still works', up.ok && Number(synced[0]?.gold)===150, `gold=${synced[0]?.gold} err=${up.error||''}`);

  // GDPR cascade
  await admin(db, `delete from auth.users where id=$1`, [ids.banned]);
  const gone = await admin(db, `select 1 from public.user_progress where user_id=$1`, [ids.banned]);
  check('account deletion still cascades (GDPR erasure)', gone.length === 0);

  await db.close();
}

console.log('############ PRE-FIX (fix migration excluded) — exploits MUST reproduce ############');
await f001('PRE-FIX', [FIX], true);
await f002('PRE-FIX', [FIX], true);
console.log('\n############ POST-FIX (all migrations) — exploits MUST fail ############');
await f001('POST-FIX', [], false);
await f002('POST-FIX', [], false);
console.log(`\n${fails===0?'\x1b[32mALL CHECKS PASSED\x1b[0m':'\x1b[31m'+fails+' CHECK(S) FAILED\x1b[0m'}`);
process.exit(fails===0?0:1);
