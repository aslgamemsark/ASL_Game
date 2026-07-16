-- ============================================================
-- Multiplayer room registry — 2026-07-16
--
-- Today a "room" is nothing but the name of an ad-hoc Supabase Realtime broadcast channel
-- (mp-room-<code>) — there is no server-side record of which codes exist, so a mistyped code
-- silently subscribes to an empty channel and waits forever, and there's no way to list public
-- rooms for a "search for match" feature. This table is a thin registry: enough to validate a
-- code exists before joining its channel, and enough to support public-room search. It does NOT
-- replace the Realtime channel as the actual game transport — WebRTC signaling still happens over
-- mp-room-<code> exactly as before.
--
-- visibility is enforced at the APPLICATION level, not by hiding rows: SELECT is open to any
-- authenticated user (same "public read, filtered client-side" pattern as profiles/leaderboards —
-- see 20260712120000's admin_set_username comment for the precedent). A private room's protection
-- is its code being an unguessable secret, not row-level secrecy; a public room's ONLY difference
-- is that the search RPC includes it. This also lets code-based joins reach a private room's row
-- without a policy that has to reason about "was this queried by exact code vs enumerated".
--
-- participant_count is only ever mutated through join_multiplayer_room/leave_multiplayer_room
-- (SECURITY DEFINER), never a direct client UPDATE, so concurrent joins can't race past
-- max_participants or resurrect a closed room.
-- ============================================================

create table public.multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('duel', 'room')),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'closed')),
  host_id uuid not null references public.profiles(id) on delete cascade,
  participant_count int not null default 1 check (participant_count >= 0),
  max_participants int not null check (max_participants > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index multiplayer_rooms_search_idx
  on public.multiplayer_rooms (mode, visibility, status, created_at)
  where visibility = 'public' and status = 'waiting';

alter table public.multiplayer_rooms enable row level security;

create policy "rooms_select_all" on public.multiplayer_rooms
  for select to authenticated using (true);

create policy "rooms_insert_own" on public.multiplayer_rooms
  for insert to authenticated with check (host_id = auth.uid());

-- Host-only direct updates: starting the game (status -> in_progress) and closing on exit
-- (status -> closed) are single-writer actions, safe as a plain RLS-gated UPDATE. Anything
-- touching participant_count goes through the RPCs below instead.
create policy "rooms_update_own" on public.multiplayer_rooms
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());


-- Atomically validates a code exists and is joinable, claims a slot, and returns the room —
-- one round trip instead of "select then hope nobody else joined between the check and the
-- update". Raises a distinct error message per failure so the client can show the right one
-- ("Invalid code" vs "Room is full" vs "Room already started").
create or replace function public.join_multiplayer_room(p_code text)
returns public.multiplayer_rooms
language plpgsql security definer set search_path = public as $$
declare
  room public.multiplayer_rooms;
begin
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

  return room;
end;
$$;

-- Decrements the participant count on exit; the room registry entry is left as-is otherwise (the
-- host explicitly closes it via a plain UPDATE, e.g. on starting the game or leaving as host) so
-- a transient drop doesn't destroy a room mid-reconnect-window.
create or replace function public.leave_multiplayer_room(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.multiplayer_rooms
    set participant_count = greatest(participant_count - 1, 0), updated_at = now()
    where code = upper(p_code) and status <> 'closed';
end;
$$;

-- Finds one open public room for "search for match" — any authenticated user, not just the
-- eventual joiner, could run the plain SELECT this wraps (rooms_select_all is already open), but
-- routing it through a function keeps the matching rule (oldest waiting room first) in one place
-- instead of duplicated in both DuelPage and RoomPage.
create or replace function public.find_public_room(p_mode text)
returns public.multiplayer_rooms
language sql security invoker set search_path = public as $$
  select * from public.multiplayer_rooms
  where mode = p_mode and visibility = 'public' and status = 'waiting'
    and participant_count < max_participants
    and created_at > now() - interval '10 minutes'
  order by created_at asc
  limit 1;
$$;

revoke execute on function public.join_multiplayer_room(text) from public, anon;
grant execute on function public.join_multiplayer_room(text) to authenticated;
revoke execute on function public.leave_multiplayer_room(text) from public, anon;
grant execute on function public.leave_multiplayer_room(text) to authenticated;
revoke execute on function public.find_public_room(text) from public, anon;
grant execute on function public.find_public_room(text) to authenticated;
