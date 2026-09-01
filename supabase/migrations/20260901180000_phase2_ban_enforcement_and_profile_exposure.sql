-- ============================================================
-- Phase 2 security remediation — 2026-09-01
--
-- Findings F-008 (HIGH) and F-003 (LOW), both confirmed by executing the real migrations against
-- a real PostgreSQL instance and attacking them as unprivileged roles (see SECURITY_AUDIT/harness).
-- ============================================================


-- ── F-008 (HIGH): ban evasion — a banned user could still reach camera-enabled rooms ──────────
--
-- The `not public.current_user_banned()` predicate was applied to user_progress, sign_attempts,
-- sign_verification_log, training_samples, friendships and profiles-update. Multiplayer arrived
-- later (20260716000000) and the predicate was never carried across; feedback and user_reports
-- never had it either.
--
-- Verified at runtime, as a genuinely banned account:
--     banned CREATES a multiplayer room ....... rows 0 -> 1   (state change achieved)
--     banned submits feedback ................. rows 0 -> 1
--     banned files a user report .............. rows 0 -> 1
--     join_multiplayer_room('AROOM1') ......... ALLOWED
--       -> banned user is now a member of AROOM1: YES
--
-- The last line is why this is HIGH rather than a tidiness issue. Room membership is precisely
-- what the Realtime policies (room_receive_members / room_send_members) authorize on, and a room
-- member receives the other participants' LIVE WEBCAM STREAM over WebRTC
-- (useMultiplayerSignaling.ts calls pc.addTrack with the local camera). Bans on this product are
-- a child-safety and harassment control; a ban that does not remove camera access to other users
-- does not do the job it exists to do.
--
-- Note this is NOT a duplicate of F-001. F-001 was "anyone can discover a private room code".
-- This is "a user we have explicitly ejected can still walk back in" — a different root cause
-- (predicate not carried to a newer feature) with the same webcam consequence.

drop policy if exists "rooms_insert_own" on public.multiplayer_rooms;
create policy "rooms_insert_own" on public.multiplayer_rooms
  for insert to authenticated
  with check (host_id = (select auth.uid()) and not public.current_user_banned());

drop policy if exists "rooms_update_own" on public.multiplayer_rooms;
create policy "rooms_update_own" on public.multiplayer_rooms
  for update to authenticated
  using (host_id = (select auth.uid()) and not public.current_user_banned())
  with check (host_id = (select auth.uid()) and not public.current_user_banned());

-- DELETE deliberately keeps NO ban predicate: tearing down a room you host is cleanup, and a
-- banned host must still be able to close a room rather than leave an orphaned one holding a
-- seat. The same reasoning applies to leave_multiplayer_room(), which is left untouched below --
-- a ban must never trap someone inside a room they are trying to exit.
drop policy if exists "rooms_delete_own" on public.multiplayer_rooms;
create policy "rooms_delete_own" on public.multiplayer_rooms
  for delete to authenticated using (host_id = (select auth.uid()));

-- Moderation-queue abuse: a banned account could still file unlimited reports and feedback,
-- which is exactly the behaviour a ban is usually issued for.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (
    ((anonymous is true and user_id is null) or ((select auth.uid()) = user_id))
    and not public.current_user_banned()
  );

drop policy if exists "reports_insert_own" on public.user_reports;
create policy "reports_insert_own" on public.user_reports
  for insert
  with check ((select auth.uid()) = reporter_id and not public.current_user_banned());

-- The RPC path needs its own check: join_multiplayer_room() is SECURITY DEFINER, so it bypasses
-- RLS entirely and the policies above cannot see it. Checked FIRST, before the throttle write --
-- a banned caller gets an identical answer for every code, so this reveals nothing about which
-- rooms exist and cannot be used as an oracle (the ordering concern the throttle exists to
-- address). It also avoids spending a throttle row on a caller who can never proceed.
create or replace function public.join_multiplayer_room(p_code text)
returns public.multiplayer_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.multiplayer_rooms;
  throttle public.room_join_attempts;
  is_existing_member boolean;
begin
  if public.current_user_banned() then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  insert into public.room_join_attempts as rja (user_id, window_start, attempts)
    values (auth.uid(), now(), 1)
    on conflict (user_id) do update set
      attempts = case when rja.window_start < now() - interval '1 minute' then 1 else rja.attempts + 1 end,
      window_start = case when rja.window_start < now() - interval '1 minute' then now() else rja.window_start end
    returning * into throttle;

  if throttle.attempts > 10 then
    raise exception 'too many join attempts' using errcode = 'P0002';
  end if;

  select * into room from public.multiplayer_rooms where code = upper(p_code) for update;

  if room.id is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if room.status = 'closed' then
    raise exception 'room closed' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.multiplayer_room_members
    where room_code = room.code and user_id = auth.uid()
  ) into is_existing_member;

  if is_existing_member then
    return room;
  end if;

  if room.participant_count >= room.max_participants then
    raise exception 'room full' using errcode = 'P0002';
  end if;

  insert into public.multiplayer_room_members (room_code, user_id)
    values (room.code, auth.uid())
    on conflict do nothing;

  update public.multiplayer_rooms
    set participant_count = participant_count + 1, updated_at = now()
    where id = room.id
    returning * into room;

  return room;
end;
$$;

revoke execute on function public.join_multiplayer_room(text) from public, anon;
grant execute on function public.join_multiplayer_room(text) to authenticated;

-- Matchmaking must not hand a banned user a room either.
create or replace function public.find_public_room(p_mode text)
returns public.multiplayer_rooms
language sql
stable
security definer
set search_path = public
as $$
  select r.* from public.multiplayer_rooms r
  where r.mode = p_mode
    and r.visibility = 'public'
    and r.status = 'waiting'
    and r.participant_count < r.max_participants
    and r.created_at > now() - interval '10 minutes'
    and r.host_id <> auth.uid()
    and not public.current_user_banned()
    and not exists (
      select 1 from public.multiplayer_room_members m
      where m.room_code = r.code and m.user_id = auth.uid()
    )
  order by r.created_at asc
  limit 1;
$$;

revoke execute on function public.find_public_room(text) from public, anon;
grant execute on function public.find_public_room(text) to authenticated;


-- ── F-003 (LOW): profiles exposed moderation + privilege state to anonymous callers ───────────
--
-- `profiles_select_public` was `using (true)`, and with Supabase's default grants that made the
-- WHOLE row readable by anon -- verified at runtime: anon read 4/4 profile rows including
-- is_admin, is_banned and ban_reason. ban_reason holds free-text moderator notes about a user,
-- and is_admin tells an attacker precisely which two accounts to target.
--
-- Postgres RLS is row-level, not column-level, so the fix is a curated projection: a
-- public_profiles view carrying only the fields other users legitimately need, with the base
-- table restricted to own-row (plus admins, who need to moderate).
--
-- Verified against every caller before changing it -- every cross-user read in web/src/ requests
-- only `id, username`:
--   FriendsPage.tsx:105,159 · LeaderboardPage.tsx:350 · AdminPanel.tsx:440,837 · lib/username.ts:14
-- Self-reads that need the sensitive columns (AuthContext's username/is_admin/is_banned/
-- ban_reason, useProgressSync's collect_training_data/region) all filter on the caller's own id
-- and therefore still pass the own-row policy unchanged.

create or replace view public.public_profiles as
  select id, username, created_at, region
  from public.profiles;

-- security_invoker = false (the default) is deliberate: the view is a fixed, curated projection
-- of columns that are public by design (usernames drive the leaderboard, friends search and
-- username-uniqueness checks), so it must return all rows regardless of the caller's own
-- row-level access. It exposes no privilege or moderation column, which is what makes that safe.
grant select on public.public_profiles to anon, authenticated;

-- The admin carve-out MUST go through a SECURITY DEFINER helper, not an inline subquery. A
-- policy ON profiles that itself selects FROM profiles re-enters the same policy and Postgres
-- aborts with "infinite recursion detected in policy for relation profiles" -- caught by running
-- this migration against a real database rather than by reading it. current_user_banned() already
-- establishes exactly this pattern (SECURITY DEFINER + pinned search_path); this is its sibling.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to anon, authenticated;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using ((select auth.uid()) = id or public.current_user_is_admin());
