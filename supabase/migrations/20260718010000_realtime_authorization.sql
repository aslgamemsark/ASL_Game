-- M2 + L1 from the pre-launch security review (second batch, before public Reddit launch):
--
-- M2 — Realtime channels previously used the default PUBLIC config: anyone holding the
-- publishable key could subscribe to any `mp-room-<code>` topic (reading WebRTC SDP/ICE for two
-- players' live webcam duel — an eavesdrop surface) or any `challenge_<userId>` topic, and could
-- inject forged messages into either. This migration adds the server half of Realtime
-- Authorization: RLS policies on realtime.messages, checked by Supabase when a client joins or
-- sends on a channel created with `private: true` (the client half, shipped in the same commit).
--
--   * challenge_<uid>: only <uid> may receive; only an ACCEPTED FRIEND of <uid> may send
--     (challenges are exclusively friend-to-friend, sent from FriendsPage).
--   * mp-room-<code>: only tracked room members may receive or send. Membership is a new
--     multiplayer_room_members table maintained entirely server-side: a trigger adds the host on
--     room insert, join_multiplayer_room adds joiners, leave_multiplayer_room removes them, and
--     row deletion cascades when the room row is deleted (host exit / cleanup job).
--
-- L1 — sign_attempts was world-readable (`using (true)`), letting any anonymous visitor dump any
-- user's full per-sign attempt history. The client never reads the table directly (verified: all
-- leaderboard reads go through the weekly_leaderboard VIEW, which executes with owner rights and
-- is unaffected) — so SELECT is scoped to the row owner.

-- ============================================================
-- Room membership registry (server-maintained; no client policies)
-- ============================================================

create table if not exists public.multiplayer_room_members (
  room_code text not null references public.multiplayer_rooms(code) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id)
);

alter table public.multiplayer_room_members enable row level security;
-- Deliberately NO client-facing policies: only the security-definer trigger/RPCs below write it,
-- and only the realtime.messages policies (which run as table-owner-adjacent internals) read it.

-- Host becomes a member the instant the room row is created (rooms are inserted directly by the
-- host client; joiners go through the RPC). SECURITY DEFINER because the inserting role
-- (authenticated) has no policy-granted access to the members table.
create or replace function public.add_host_to_room_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.multiplayer_room_members (room_code, user_id)
    values (new.code, new.host_id)
    on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists multiplayer_rooms_add_host_member on public.multiplayer_rooms;
create trigger multiplayer_rooms_add_host_member
  after insert on public.multiplayer_rooms
  for each row execute function public.add_host_to_room_members();

-- Re-create join RPC: identical to 20260718000000 (throttle-first, same error contract) plus the
-- member registration that private-channel access now depends on.
create or replace function public.join_multiplayer_room(p_code text)
returns public.multiplayer_rooms
language plpgsql security definer set search_path = public as $$
declare
  room public.multiplayer_rooms;
  throttle public.room_join_attempts;
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

-- Re-create leave RPC: original behavior plus member-row removal, so a departed player loses
-- channel access immediately rather than when the room is eventually deleted.
create or replace function public.leave_multiplayer_room(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.multiplayer_rooms
    set participant_count = greatest(participant_count - 1, 0), updated_at = now()
    where code = upper(p_code) and status <> 'closed';

  delete from public.multiplayer_room_members
    where room_code = upper(p_code) and user_id = auth.uid();
end;
$$;

-- ============================================================
-- Realtime Authorization policies (checked only for private: true channels)
-- ============================================================

drop policy if exists "challenge_receive_own" on realtime.messages;
create policy "challenge_receive_own" on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() = 'challenge_' || (select auth.uid())::text
  );

-- 'challenge_' is 10 characters, so the target user id starts at position 11.
drop policy if exists "challenge_send_friends" on realtime.messages;
create policy "challenge_send_friends" on realtime.messages
  for insert to authenticated
  with check (
    extension = 'broadcast'
    and realtime.topic() like 'challenge\_%'
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id::text = substring(realtime.topic() from 11))
          or
          (f.addressee_id = (select auth.uid()) and f.requester_id::text = substring(realtime.topic() from 11))
        )
    )
  );

drop policy if exists "room_receive_members" on realtime.messages;
create policy "room_receive_members" on realtime.messages
  for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.multiplayer_room_members m
      where realtime.topic() = 'mp-room-' || m.room_code
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "room_send_members" on realtime.messages;
create policy "room_send_members" on realtime.messages
  for insert to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.multiplayer_room_members m
      where realtime.topic() = 'mp-room-' || m.room_code
        and m.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- L1 — sign_attempts: owner-only reads
-- ============================================================

drop policy if exists "attempts_select_public" on public.sign_attempts;
create policy "attempts_select_own" on public.sign_attempts
  for select using (auth.uid() = user_id);
