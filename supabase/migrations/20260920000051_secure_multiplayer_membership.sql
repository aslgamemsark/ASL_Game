-- Only an actual membership removal may decrement a room. Take the same room lock
-- as join so duplicate/concurrent leaves cannot race a new participant's admission.
create or replace function public.leave_multiplayer_room(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  remaining int;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform 1 from public.multiplayer_rooms where code = upper(p_code) for update;
  if not found then return; end if;

  delete from public.multiplayer_room_members
    where room_code = upper(p_code) and user_id = caller;
  if not found then return; end if;

  update public.multiplayer_rooms
    set participant_count = greatest(participant_count - 1, 0), updated_at = now()
    where code = upper(p_code)
    returning participant_count into remaining;
  if remaining = 0 then
    delete from public.multiplayer_rooms where code = upper(p_code);
  end if;
end;
$$;

revoke execute on function public.leave_multiplayer_room(text) from public, anon;
grant execute on function public.leave_multiplayer_room(text) to authenticated;

-- Expected denials are data, not exceptions: raising rolls back the attempt counter.
-- Version the contract so old clients fail safely instead of treating a denial as a join.
create function public.join_multiplayer_room_v2(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  room public.multiplayer_rooms;
  throttle public.room_join_attempts;
  denial text;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.room_join_attempts as rja (user_id, window_start, attempts)
    values (caller, now(), 1)
    on conflict (user_id) do update set
      attempts = case when rja.window_start < now() - interval '1 minute' then 1 else least(rja.attempts, 10) + 1 end,
      window_start = case when rja.window_start < now() - interval '1 minute' then now() else rja.window_start end
    returning * into throttle;

  if throttle.attempts > 10 then
    return jsonb_build_object('room', null, 'error', 'too many join attempts');
  end if;

  select * into room from public.multiplayer_rooms where code = upper(p_code) for update;
  if room.id is null then
    denial := 'room not found';
  elsif room.status = 'closed' then
    denial := 'room closed';
  elsif exists (
    select 1 from public.multiplayer_room_members
    where room_code = room.code and user_id = caller
  ) then
    return jsonb_build_object('room', to_jsonb(room), 'error', null);
  elsif room.status = 'in_progress' then
    denial := 'room already started';
  elsif room.participant_count >= room.max_participants then
    denial := 'room full';
  end if;

  if denial is not null then
    return jsonb_build_object('room', null, 'error', denial);
  end if;

  update public.multiplayer_rooms
    set participant_count = participant_count + 1, updated_at = now()
    where id = room.id returning * into room;
  insert into public.multiplayer_room_members (room_code, user_id)
    values (room.code, caller);
  return jsonb_build_object('room', to_jsonb(room), 'error', null);
end;
$$;

revoke execute on function public.join_multiplayer_room_v2(text) from public, anon;
grant execute on function public.join_multiplayer_room_v2(text) to authenticated;
-- Leaving the old entry point callable would bypass the corrected throttle.
revoke execute on function public.join_multiplayer_room(text) from public, anon, authenticated;

-- Private codes must not be enumerable. Public discovery is already exposed by
-- find_public_room; membership SELECT is self-only and introduces no RLS recursion.
drop policy if exists "rooms_select_all" on public.multiplayer_rooms;
create policy "rooms_select_members" on public.multiplayer_rooms
  for select to authenticated using (
    host_id = (select auth.uid()) or exists (
      select 1 from public.multiplayer_room_members m
      where m.room_code = multiplayer_rooms.code and m.user_id = (select auth.uid())
    )
  );

-- Hosts only update status in the app. Counts and capacity are not client-writable.
revoke update on public.multiplayer_rooms from public, anon, authenticated;
grant update (status) on public.multiplayer_rooms to authenticated;
-- Host exit deletes its room; the existing rooms_delete_own policy limits this grant.
grant delete on public.multiplayer_rooms to authenticated;
-- Creation must start with the host alone; prevent custom counts/status on insert too.
drop policy if exists "rooms_insert_own" on public.multiplayer_rooms;
create policy "rooms_insert_own" on public.multiplayer_rooms
  for insert to authenticated with check (
    host_id = (select auth.uid()) and participant_count = 1 and status = 'waiting'
  );
