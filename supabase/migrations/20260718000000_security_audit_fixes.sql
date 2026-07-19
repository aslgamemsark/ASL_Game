-- Security-audit fixes (2026-07-18 pre-launch review):
--
-- 1. L2 — Restore the banned-user write gate on user_progress. The original policies from
--    20260707120000_admin_panel.sql included `and not public.current_user_banned()`, but
--    20260712120000_region_leaderboard.sql re-created progress_insert_own / progress_update_own
--    (to split the old FOR ALL policy around a public SELECT) and dropped the ban check in the
--    process. Banned users could still sync progress writes. Re-create both policies with the
--    gate, matching every other user-owned table.
--
-- 2. M4 — Rate-limit join_multiplayer_room. Room codes gate entry to live-webcam sessions and
--    the RPC previously allowed unlimited guesses, making private-room codes brute-forceable.
--    Track attempts per user in a small table and refuse more than 10 join attempts per minute.
--    (Client-side codes are simultaneously upgraded to 8-char CSPRNG values — this throttle is
--    the server half of that fix.)

-- ============================================================
-- 1. user_progress ban gate (idempotent drop + create)
-- ============================================================

drop policy if exists "progress_insert_own" on public.user_progress;
create policy "progress_insert_own" on public.user_progress
  for insert with check (auth.uid() = user_id and not public.current_user_banned());

drop policy if exists "progress_update_own" on public.user_progress;
create policy "progress_update_own" on public.user_progress
  for update
  using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

-- ============================================================
-- 2. join_multiplayer_room attempt throttle
-- ============================================================

-- One row per user; a rolling one-minute window is enough to make brute-forcing a 40-bit code
-- space (8 chars, 32-symbol alphabet) computationally irrelevant while never bothering a real
-- player (a human retyping a misheard code makes a handful of attempts, not ten per minute).
create table if not exists public.room_join_attempts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts int not null default 0
);

alter table public.room_join_attempts enable row level security;
-- No client-facing policies on purpose: only the SECURITY DEFINER RPC below touches this table.

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

  return room;
end;
$$;
