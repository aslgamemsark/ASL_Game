-- ============================================================
-- Stop "Search for a Match" from matching you with yourself — 2026-07-31
--
-- THE BUG THAT MADE MULTIPLAYER UNUSABLE. Reproduced from production data, not theory:
--
--   code      host_id   participant_count   actual member rows
--   AEST8CT5  80296cd1  2                   [80296cd1]            <- only the host
--   GSUJPVRA  90c26e12  2                   [90c26e12]            <- only the host
--   Z3ED3JA6  80296cd1  2                   [80296cd1]            <- only the host
--   GV638356  80296cd1  2                   [80296cd1, 90c26e12]  <- a real match
--
-- Three of four duel rooms in one test session had participant_count = 2 with exactly ONE member,
-- and that member was the host. The sequence:
--
--   1. A creates a PUBLIC duel room.        -> count 1, A is a member (via trigger).
--   2. A taps "Search for a Match".         -> find_public_room has no filter on who is asking,
--                                              so it returns A'S OWN ROOM.
--   3. A joins it.                          -> count goes to 2. The member insert hits the PK
--                                              (room_code, user_id) that the trigger already
--                                              created and does nothing.
--   4. The room now advertises 2/2 = FULL.  -> the real opponent gets 'room full' and cannot get
--                                              in. A waits in their own room forever.
--
-- So the room fills itself with one person, locks everyone else out, and both players conclude
-- multiplayer is broken. participant_count and multiplayer_room_members had also silently
-- disagreed, which is what made this diagnosable after the fact.
--
-- FIX (root cause): a room you are already in is not a match. find_public_room now excludes any
-- room where the caller is the host or an existing member. Step 2 can no longer return your own
-- room, so step 3 cannot happen.
--
-- Companion migration 20260731120000 makes join_multiplayer_room idempotent for existing members,
-- which independently prevents the count inflation in step 3 from ANY path (a shared link, a
-- double-tapped Join, a reconnect). Either fix alone stops the observed failure; both together
-- mean neither a new entry point nor a stale client can reintroduce it.
--
-- SECURITY DEFINER is required and safe here: the function must read multiplayer_room_members,
-- which deliberately has RLS on and NO client-facing policies. It remains read-only and still
-- returns only rooms matching visibility='public' AND status='waiting' AND a free slot AND the
-- 10-minute freshness window, so definer rights expose nothing the previous version did not.
-- ============================================================

create or replace function public.find_public_room(p_mode text)
returns public.multiplayer_rooms
language sql
security definer
set search_path = public
as $$
  select r.* from public.multiplayer_rooms r
  where r.mode = p_mode
    and r.visibility = 'public'
    and r.status = 'waiting'
    and r.participant_count < r.max_participants
    and r.created_at > now() - interval '10 minutes'
    -- Never match someone with a room they are already in. host_id covers the room they just
    -- created; the members check also covers a room they joined earlier and backed out of, which
    -- would otherwise be handed straight back to them.
    and r.host_id <> auth.uid()
    and not exists (
      select 1 from public.multiplayer_room_members m
      where m.room_code = r.code and m.user_id = auth.uid()
    )
  order by r.created_at asc
  limit 1;
$$;

-- ── Repair the rooms the bug already corrupted ───────────────────────────────
-- Their participant_count counts a self-join that never produced a member row, so they are stuck
-- advertising as full. Rebuild the count from the membership table, which is the truth: it is
-- written only by the trigger and the join/leave RPCs, one row per real participant.
-- Scoped to rooms that are still joinable — finished/closed rooms are left exactly as they are.
update public.multiplayer_rooms r
set participant_count = (
      select count(*) from public.multiplayer_room_members m where m.room_code = r.code
    ),
    updated_at = now()
where r.status <> 'closed'
  and r.participant_count <> (
      select count(*) from public.multiplayer_room_members m where m.room_code = r.code
    );
