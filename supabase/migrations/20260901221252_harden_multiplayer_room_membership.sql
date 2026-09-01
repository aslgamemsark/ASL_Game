-- Close two membership/accounting gaps in the SECURITY DEFINER room RPCs.

create or replace function public.join_multiplayer_room(p_code text)
returns public.multiplayer_rooms
language plpgsql security definer set search_path = public as $$
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
  if room.id is null then raise exception 'room not found' using errcode = 'P0002'; end if;
  if room.status = 'closed' then raise exception 'room closed' using errcode = 'P0002'; end if;

  select exists (
    select 1 from public.multiplayer_room_members
    where room_code = room.code and user_id = auth.uid()
  ) into is_existing_member;
  if is_existing_member then return room; end if;

  if room.status = 'in_progress' then
    raise exception 'room already started' using errcode = 'P0002';
  end if;
  if room.participant_count >= room.max_participants then
    raise exception 'room full' using errcode = 'P0002';
  end if;

  insert into public.multiplayer_room_members (room_code, user_id)
    values (room.code, auth.uid());
  update public.multiplayer_rooms
    set participant_count = participant_count + 1, updated_at = now()
    where id = room.id returning * into room;
  return room;
end;
$$;

revoke execute on function public.join_multiplayer_room(text) from public, anon;
grant execute on function public.join_multiplayer_room(text) to authenticated;

create or replace function public.leave_multiplayer_room(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  was_member uuid;
  remaining int;
begin
  delete from public.multiplayer_room_members
    where room_code = upper(p_code) and user_id = auth.uid()
    returning user_id into was_member;
  if was_member is null then return; end if;

  update public.multiplayer_rooms
    set participant_count = greatest(participant_count - 1, 0), updated_at = now()
    where code = upper(p_code) and status <> 'closed'
    returning participant_count into remaining;
  if remaining = 0 then
    delete from public.multiplayer_rooms where code = upper(p_code);
  end if;
end;
$$;

revoke execute on function public.leave_multiplayer_room(text) from public, anon;
grant execute on function public.leave_multiplayer_room(text) to authenticated;
