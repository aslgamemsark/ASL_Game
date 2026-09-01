-- ============================================================
-- Security audit remediation — 2026-09-01
--
-- Two confirmed authorization findings from the commercial-launch security
-- audit (see SECURITY_AUDIT/FINDINGS.md, F-001 and F-002). Both are
-- authorization bypasses reachable by any *authenticated* user using nothing
-- but the public anon key and their own valid JWT — no privileged access, no
-- stolen credentials, no client tampering required.
-- ============================================================


-- ── F-001 (HIGH): private multiplayer rooms were joinable by any user ──────
--
-- `rooms_select_all` was `for select to authenticated using (true)`, so ANY
-- logged-in user could read every row of multiplayer_rooms — including the
-- `code` column of rooms created with `visibility = 'private'`.
--
-- `join_multiplayer_room(p_code)` deliberately does not check visibility:
-- possessing the code IS the authorization for a private room, and it already
-- rate-limits join attempts to 10/minute *before* revealing whether a code
-- exists, specifically so codes cannot be brute-forced. That throttle was
-- sound but moot — an attacker never had to guess a code, because they could
-- simply select every code straight out of the table.
--
-- Impact is not limited to nuisance joins: a joined member becomes a real row
-- in multiplayer_room_members, which is exactly what the Realtime
-- Authorization policies (`room_receive_members` / `room_send_members`, see
-- 20260718010000) check. So the intruder passes those too, completes WebRTC
-- signalling, and `pc.ontrack` delivers the other participants' LIVE WEBCAM
-- STREAM (hooks/useMultiplayerSignaling.ts calls `pc.addTrack(...)` with the
-- local camera stream). For an ASL-learning product whose own launch
-- checklist flags COPPA/GDPR-minors exposure as a blocker, unauthorized
-- webcam access to a room a user believed was private is the most serious
-- issue found in this audit.
--
-- Fix: a user may read a room row only if they host it or are already a
-- member of it. This does NOT break any working flow, because nothing in the
-- client ever SELECTs this table directly — verified against src/: every read
-- path goes through `find_public_room()` or `join_multiplayer_room()`, both
-- SECURITY DEFINER and therefore unaffected by RLS. The three write paths
-- (App.tsx:229, DuelPage.tsx:342, RoomPage.tsx:434) all destructure only
-- `{ error }` with no chained `.select()`, so PostgREST uses `return=minimal`
-- and needs no SELECT privilege either.
--
-- `(select auth.uid())` rather than bare `auth.uid()` matches the initplan
-- optimization already applied in 20260719010000 — it lets Postgres evaluate
-- the uid once per query instead of once per row.

drop policy if exists "rooms_select_all" on public.multiplayer_rooms;

create policy "rooms_select_member" on public.multiplayer_rooms
for select to authenticated
using (
  host_id = (select auth.uid())
  or exists (
    select 1
    from public.multiplayer_room_members m
    where m.room_code = multiplayer_rooms.code
      and m.user_id = (select auth.uid())
  )
);


-- ── F-002 (HIGH): economy delta guard bypassable via DELETE + INSERT ───────
--
-- 20260710120000 added `guard_progress_deltas()` and 20260712130000 extended
-- it to cover the full economy, capping how much gold/xp/cosmetics/worlds a
-- single write may add. That trigger is attached `before update` ONLY.
--
-- Meanwhile user_progress carried BOTH:
--   progress_delete_own  — for delete using (auth.uid() = user_id)
--   progress_insert_own  — for insert with check (auth.uid() = user_id ...)
--
-- so the ceiling was defeated by a two-step sequence that never once performs
-- an UPDATE, and therefore never once fires the guard:
--
--   delete from user_progress where user_id = auth.uid();
--   insert into user_progress (user_id, gold, xp, level, signs,
--     total_correct_signs, owned_cosmetics, unlocked_world_ids, badges,
--     rename_cards, streak_freezes, longest_streak)
--   values (auth.uid(), 999999999, 999999999, 999, 999999, 999999,
--     '{...every cosmetic...}', '{...every world...}', '{...every badge...}',
--     999, 999, 999);
--
-- Result: instant top of the PUBLIC weekly leaderboard (weekly_leaderboard is
-- granted to anon), every gold-gated cosmetic, and every world unlocked —
-- with the entire anti-cheat control bypassed rather than defeated.
--
-- Fix, in two layers:
--
-- 1. Drop the DELETE policy. This closes the chain at its root: the row is
--    created for every user by handle_new_user() at signup and can no longer
--    be removed by the client, so every subsequent write necessarily takes
--    upsert's ON CONFLICT -> UPDATE path, which the existing guard covers.
--    Nothing in the client ever deletes this row (verified: no `.delete()`
--    against user_progress anywhere in src/), and account deletion is
--    unaffected — erasure still cascades auth.users -> profiles ->
--    user_progress via ON DELETE CASCADE, so GDPR right-to-erasure is intact.
--
-- 2. Guard the INSERT path too, for the residual case of a user whose row is
--    genuinely missing (creation predating the trigger, or a failed
--    handle_new_user). This deliberately CAPS rather than zeroes: hooks/
--    useProgressSync.ts pushes real progress through
--    `.upsert(payload, { onConflict: 'user_id' })`, which lands on INSERT
--    when the row is absent. Forcing zeroes there would silently wipe a real
--    user's legitimate local progress on their next sync — a worse bug than
--    the one being fixed. Capping at the same ceilings the UPDATE guard uses
--    preserves every honest write while making the 999999999 insert
--    impossible.

drop policy if exists "progress_delete_own" on public.user_progress;

create or replace function public.guard_progress_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin   boolean;
  gold_ceiling      constant int := 20000;
  xp_ceiling        constant int := 10000;
  signs_ceiling     constant int := 2000;
  correct_ceiling   constant int := 2000;
  cosmetics_ceiling constant int := 5;
  worlds_ceiling    constant int := 3;
  badges_ceiling    constant int := 8;
  rename_ceiling    constant int := 20;
  freeze_ceiling    constant int := 10;
begin
  -- auth.uid() is NULL for handle_new_user() (a trigger on auth.users during
  -- signup), migrations, the SQL editor and the service-role key. Those
  -- callers already bypass RLS entirely and are not the threat model here;
  -- an anonymous PostgREST caller can never reach this INSERT at all, because
  -- progress_insert_own requires auth.uid() = user_id, which is never true
  -- when auth.uid() is NULL. Same reasoning as
  -- protect_privileged_profile_columns().
  if auth.uid() is null then
    return new;
  end if;

  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if coalesce(caller_is_admin, false) then
    return new;
  end if;

  new.gold                := least(coalesce(new.gold, 0), gold_ceiling);
  new.xp                  := least(coalesce(new.xp, 0), xp_ceiling);
  new.signs               := least(coalesce(new.signs, 0), signs_ceiling);
  new.total_correct_signs := least(coalesce(new.total_correct_signs, 0), correct_ceiling);
  new.rename_cards        := least(coalesce(new.rename_cards, 0), rename_ceiling);
  new.streak_freezes      := least(coalesce(new.streak_freezes, 1), freeze_ceiling);

  -- Array columns: truncate to the ceiling, preserving order, so a first
  -- sync keeps the earliest-earned entries rather than an arbitrary subset.
  if coalesce(array_length(new.owned_cosmetics, 1), 0) > cosmetics_ceiling then
    new.owned_cosmetics := (
      select coalesce(array_agg(x order by ord), '{}')
      from (select x, ord from unnest(new.owned_cosmetics) with ordinality as t(x, ord)
            order by ord limit cosmetics_ceiling) capped
    );
  end if;

  if coalesce(array_length(new.unlocked_world_ids, 1), 0) > worlds_ceiling then
    new.unlocked_world_ids := (
      select coalesce(array_agg(x order by ord), '{}')
      from (select x, ord from unnest(new.unlocked_world_ids) with ordinality as t(x, ord)
            order by ord limit worlds_ceiling) capped
    );
  end if;

  if coalesce(array_length(new.badges, 1), 0) > badges_ceiling then
    new.badges := (
      select coalesce(array_agg(x order by ord), '{}')
      from (select x, ord from unnest(new.badges) with ordinality as t(x, ord)
            order by ord limit badges_ceiling) capped
    );
  end if;

  return new;
end;
$$;

-- Trigger function: never callable directly via /rpc/. Same reasoning and
-- same explicit anon+authenticated revoke as 20260712140000 — Supabase's
-- schema-level default privileges grant EXECUTE to those roles directly on
-- new functions, so revoking from PUBLIC alone would not be sufficient.
revoke execute on function public.guard_progress_insert() from public;
revoke execute on function public.guard_progress_insert() from anon, authenticated;

drop trigger if exists guard_progress_insert_trg on public.user_progress;
create trigger guard_progress_insert_trg
  before insert on public.user_progress
  for each row execute function public.guard_progress_insert();
