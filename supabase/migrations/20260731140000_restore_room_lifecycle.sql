-- ============================================================
-- Restore multiplayer room lifecycle: rooms never got cleaned up — 2026-07-31
--
-- REPORTED SYMPTOM: "we made the room the day before yesterday, why isn't it automatically
-- closed?" Confirmed against production: rooms created on 2026-07-16, 07-18 and 07-19 were all
-- still sitting at status='waiting'. Nothing in the database had ever deleted a room.
--
-- Migration 20260716140000_cleanup_multiplayer_rooms.sql was written to fix exactly this. It never
-- took effect, for TWO independent reasons — fixing either one alone would still have left rooms
-- accumulating:
--
--   1. IT WAS NEVER APPLIED TO PRODUCTION. Verified directly: cleanup_stale_multiplayer_rooms()
--      does not exist, the rooms_delete_own policy does not exist, and cron.job contains exactly
--      one entry (trim_training_samples). The scheduled sweep has never run because it was never
--      created.
--
--   2. THE REPO ITSELF REVERTS IT. 20260716140000 taught leave_multiplayer_room to DELETE the room
--      once the last participant leaves. Two days later 20260718010000_realtime_authorization.sql
--      re-created that same function to add member-row removal — and silently dropped the
--      delete-at-zero behaviour, because `create or replace function` replaces the whole body.
--      So even a clean `supabase db reset` produces the version that leaks rooms. This is why the
--      bug survived: applying the migrations correctly, in order, still yields broken behaviour.
--      Production's live definition matches the 07-18 version exactly, confirming the sequence.
--
-- This migration restores the intended behaviour and MERGES both halves, so a future
-- `create or replace` of this function starts from a body that already does everything.
--
-- Interaction worth naming: the sweep deletes status='waiting' rooms older than 30 minutes. Duel
-- rooms only became eligible to escape that window once DuelPage started setting
-- status='in_progress' at match start (shipped in the same change as this migration) — before
-- that, a duel room stayed 'waiting' for its whole life and a long session could have been swept
-- out from under the players. The two changes belong together.
-- ============================================================

-- Host may delete their own room outright — the "host explicitly ends the game" exit path.
drop policy if exists "rooms_delete_own" on public.multiplayer_rooms;
create policy "rooms_delete_own" on public.multiplayer_rooms
  for delete to authenticated using (host_id = auth.uid());

-- Merged definition: decrement the count, drop the caller's membership row (20260718010000), and
-- delete the room once nobody is left in it (20260716140000). A room with zero participants has
-- nothing to reconnect to, so leaving it as a permanent 0-participant row serves no purpose.
create or replace function public.leave_multiplayer_room(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  remaining int;
begin
  update public.multiplayer_rooms
    set participant_count = greatest(participant_count - 1, 0), updated_at = now()
    where code = upper(p_code) and status <> 'closed'
    returning participant_count into remaining;

  delete from public.multiplayer_room_members
    where room_code = upper(p_code) and user_id = auth.uid();

  -- `remaining` is null when the update matched nothing (already-closed or already-deleted room),
  -- which must NOT be treated as zero.
  if remaining = 0 then
    delete from public.multiplayer_rooms where code = upper(p_code);
  end if;
end;
$$;

-- Safety net for rooms that never run either app-level exit path — a crashed tab, a killed app or
-- a dead battery fires no client code at all, so nothing else guarantees cleanup.
create or replace function public.cleanup_stale_multiplayer_rooms()
returns void
language sql security definer set search_path = public as $$
  delete from public.multiplayer_rooms
  where (status = 'waiting' and created_at < now() - interval '30 minutes')
     or (status = 'in_progress' and updated_at < now() - interval '3 hours')
     or (status = 'closed');
$$;

revoke execute on function public.cleanup_stale_multiplayer_rooms() from public, anon, authenticated;

-- Schedule it. Idempotent: unschedule any existing job of the same name first, so re-running this
-- migration cannot end up with the sweep registered twice.
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-stale-multiplayer-rooms') then
    perform cron.unschedule('cleanup-stale-multiplayer-rooms');
  end if;
  perform cron.schedule(
    'cleanup-stale-multiplayer-rooms',
    '*/15 * * * *',
    $sweep$select public.cleanup_stale_multiplayer_rooms();$sweep$
  );
end $$;
