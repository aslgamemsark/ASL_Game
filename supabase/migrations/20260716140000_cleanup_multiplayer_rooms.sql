-- ============================================================
-- Multiplayer room cleanup — 2026-07-16
--
-- Rooms were never actually deleted — only ever left at status='waiting'/'in_progress', or
-- (RoomPage's host only) updated to 'closed' — so every duel/room ever created stayed in the
-- table permanently. Confirmed live: 6 rows, all still 'waiting', going back ~19 hours of
-- testing. Two root causes, both fixed here:
--
-- 1. leave_multiplayer_room only ever decremented participant_count, even down to 0 — a room
--    nobody is left in has nothing to reconnect to, so it should just be deleted at that point
--    instead of left as a permanent zero-participant row.
-- 2. There was no host-delete path at all beyond RoomPage's update-to-'closed' (DuelPage's host
--    exit didn't even do that — it called leave_multiplayer_room like a guest would, since it
--    never tracked host/guest at all). A 'closed' status has no further consumer (only used to
--    reject joins, which "row not found" achieves identically), so the host-close path now
--    deletes outright via a new RLS policy instead of leaving a permanent zombie row.
--
-- A scheduled sweep is still needed on top of both: a browser crash or a killed tab fires no
-- client code at all, so nothing guarantees either app-level path ever runs.
-- ============================================================

-- Host may delete their own room outright — used by the "host explicitly ends the game" exit
-- path (both DuelPage and RoomPage), replacing the old update-to-'closed' which just left a
-- permanent row with no further purpose.
create policy "rooms_delete_own" on public.multiplayer_rooms
  for delete to authenticated using (host_id = auth.uid());

-- Deletes the row once nobody is left in it, instead of leaving a permanent 0-participant row.
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

  if remaining = 0 then
    delete from public.multiplayer_rooms where code = upper(p_code);
  end if;
end;
$$;

-- Safety net for rooms that never go through either app-level cleanup path (a crashed/killed
-- tab fires no client code at all) — sweeps anything stale regardless of how it got that way.
-- Requires the pg_cron extension; if `create extension` below errors, enable "pg_cron" from the
-- Supabase dashboard's Database -> Extensions page first, then re-run this file.
create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_stale_multiplayer_rooms()
returns void
language sql security definer set search_path = public as $$
  delete from public.multiplayer_rooms
  where (status = 'waiting' and created_at < now() - interval '30 minutes')
     or (status = 'in_progress' and updated_at < now() - interval '3 hours')
     or (status = 'closed');
$$;

select cron.schedule(
  'cleanup-stale-multiplayer-rooms',
  '*/15 * * * *',
  $$select public.cleanup_stale_multiplayer_rooms();$$
);
