-- ============================================================
-- Make join_multiplayer_room idempotent for players already in the room — 2026-07-31
--
-- DEFECT (found while building the multiplayer integration suite, e2e/multiplayer.spec.ts):
-- join_multiplayer_room treated every call as a NEW participant. It incremented
-- participant_count unconditionally, and the member insert was `on conflict do nothing` — so the
-- count and the actual member set could disagree, and re-entry by an existing player was
-- rejected. Three real user-visible consequences, all on the reconnect path multiplayer depends
-- on most:
--
--   1. RECONNECT AFTER A DROPPED SOCKET WAS IMPOSSIBLE. Once the host starts the match the room is
--      status='in_progress', so a player whose phone slept, whose tab was backgrounded, or whose
--      network blipped got 'room already started' when their client retried the join — even
--      though they were still a registered member of that exact room. There was no path back into
--      a game they were already in.
--   2. A DOUBLE-TAPPED "Join" BURNED THE LAST SLOT. Two rapid calls from one client incremented
--      participant_count twice, so a 2-player duel reached max_participants with one human in it
--      and the actual opponent was then told 'room full'.
--   3. participant_count DRIFTED ABOVE THE TRUE HEADCOUNT, which also mis-sorted/mis-filtered
--      public rooms in find_public_room.
--
-- FIX: check membership inside the same `for update` lock and return the room unchanged when the
-- caller is already a member. This is the project's "define errors out of existence" rule
-- (.claude/rules/error-handling.md): re-entry is not an error condition to report, it is a no-op
-- that should succeed. Callers need no change — they already treat a non-error return as "I'm in".
--
-- ORDERING MATTERS and is deliberate: the membership check sits AFTER the 'closed' guard (a closed
-- room must stay closed to everyone) but BEFORE the 'in_progress' and 'room full' guards — those
-- two exist to keep NEW players out, and applying them to an existing member is exactly bug 1.
--
-- Throttle behaviour is unchanged and still runs first, so re-entry cannot be used to bypass the
-- brute-force limit on code guessing.
-- ============================================================

create or replace function public.join_multiplayer_room(p_code text)
returns public.multiplayer_rooms
language plpgsql security definer set search_path = public as $$
declare
  room public.multiplayer_rooms;
  throttle public.room_join_attempts;
  is_existing_member boolean;
begin
  -- Throttle FIRST, before revealing whether the code exists — otherwise the error itself
  -- becomes the brute-force oracle.
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

  -- Re-entry by someone already in this room: reconnect, double-tapped Join, resumed background
  -- tab. Claim nothing, reject nothing, return the room as it stands.
  select exists (
    select 1 from public.multiplayer_room_members
    where room_code = room.code and user_id = auth.uid()
  ) into is_existing_member;

  if is_existing_member then
    return room;
  end if;

  if room.status = 'in_progress' then
    raise exception 'room already started' using errcode = 'P0002';
  end if;
  if room.participant_count >= room.max_participants then
    raise exception 'room full' using errcode = 'P0002';
  end if;

  update public.multiplayer_rooms
    set participant_count = participant_count + 1, updated_at = now()
    where id = room.id
    returning * into room;

  insert into public.multiplayer_room_members (room_code, user_id)
    values (room.code, auth.uid())
    on conflict do nothing;

  return room;
end;
$$;
