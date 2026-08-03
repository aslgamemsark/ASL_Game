-- ============================================================
-- Admin panel — 2026-07-07
-- Adds owner/dev-admin capability: is_admin/is_banned identity, server-authoritative gold +
-- cosmetics, an audit log, and a world-visibility flag table. Idempotent: safe to re-run.
--
-- ARCHITECTURE: admin mutations go through SECURITY DEFINER RPC functions (below), never through
-- a broad "admins can update any row" RLS policy — a blanket policy would let the client craft
-- arbitrary UPDATE payloads (including columns we didn't intend). Existing RLS on profiles/
-- user_progress stays exactly as strict as it is today for everyone; only these named functions
-- can act across users, and only after checking the caller is an admin.
-- ============================================================


-- ── 1. IDENTITY COLUMNS ──────────────────────────────────────
alter table public.profiles add column if not exists is_admin    boolean default false not null;
alter table public.profiles add column if not exists is_banned   boolean default false not null;
alter table public.profiles add column if not exists ban_reason  text;

-- SECURITY: without this, the existing "profiles_update_own" policy (auth.uid() = id, no column
-- restriction) would let ANY signed-in user self-promote with
-- `supabase.from('profiles').update({ is_admin: true })` the moment these columns exist. Block
-- changes to the privileged columns unless the CALLER (not the row being edited) is already an
-- admin.
create or replace function public.protect_privileged_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  -- auth.uid() is NULL outside a real Supabase-Auth/PostgREST request (SQL Editor, migrations,
  -- the service-role key) — those callers already bypass RLS entirely, and an anonymous/no-JWT
  -- caller is independently blocked from ever reaching this UPDATE by the existing
  -- "profiles_update_own" policy (auth.uid() = id is never true when auth.uid() is NULL). So this
  -- check only needs to fire for a real authenticated end user trying to self-promote.
  if auth.uid() is null then
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     or new.is_banned is distinct from old.is_banned
     or new.ban_reason is distinct from old.ban_reason then
    select is_admin into caller_is_admin from public.profiles where id = auth.uid();
    if not coalesce(caller_is_admin, false) then
      raise exception 'not authorized to change privileged profile columns' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns_trg on public.profiles;
create trigger protect_privileged_profile_columns_trg
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();

-- Bootstrap the two owner accounts (confirmed to already exist).
update public.profiles set is_admin = true where username in ('Saad', 'ARKhan7');


-- ── 2. SERVER-AUTHORITATIVE GOLD + COSMETICS ─────────────────
-- Previously gold/cosmetics lived ONLY in the client Zustand store (see useProgressSync.ts) —
-- never synced, so an admin grant would have had nowhere durable to land. These mirror the
-- Zustand fields and are now included in the regular sync (own-user read/write, unchanged RLS).
alter table public.user_progress add column if not exists gold             integer default 0 not null;
alter table public.user_progress add column if not exists owned_cosmetics  text[]  default '{}' not null;
alter table public.user_progress add column if not exists equipped_border text;
alter table public.user_progress add column if not exists equipped_avatar text;

-- Extend the existing sanity-bound constraint (VULN-01 partial mitigation) to cover gold too —
-- same philosophy: this doesn't make client-reported gold trustworthy, it just caps the blast
-- radius of the crudest forgery attempts, consistent with the xp/streak bounds already in place.
alter table public.user_progress drop constraint if exists user_progress_sane;
alter table public.user_progress add constraint user_progress_sane check (
  xp >= 0 and xp <= 100000000
  and level >= 1 and level <= 1000
  and streak >= 0 and streak <= 100000
  and longest_streak >= 0 and longest_streak <= 100000
  and gold >= 0 and gold <= 100000000
);


-- ── 3. ADMIN AUDIT LOG ───────────────────────────────────────
-- Write-only via the RPC functions below (no insert policy for regular clients — RLS denies by
-- default when a policy is absent for that action). Read-only for admins, so both owners can see
-- what the other has done.
create table if not exists public.admin_audit_log (
  id              bigint generated always as identity primary key,
  admin_id        uuid references public.profiles on delete set null,
  action          text        not null,
  target_user_id  uuid references public.profiles on delete set null,
  payload         jsonb       default '{}' not null,
  created_at      timestamptz default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_read_admin" on public.admin_audit_log;
create policy "admin_audit_log_read_admin" on public.admin_audit_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);


-- ── 4. WORLD VISIBILITY FLAGS ─────────────────────────────────
-- Public-read override layer on top of the static WORLDS array (web/src/data/worlds.ts) — lets
-- an admin hide/show/mark-"coming soon" a world without a code deploy. Writes only via the
-- admin_set_world_flag RPC below (no direct insert/update policy for regular clients).
create table if not exists public.world_flags (
  world_id     text primary key,
  enabled      boolean default true  not null,
  coming_soon  boolean default false not null,
  updated_by   uuid references public.profiles on delete set null,
  updated_at   timestamptz default now()
);

alter table public.world_flags enable row level security;

drop policy if exists "world_flags_select_public" on public.world_flags;
create policy "world_flags_select_public" on public.world_flags for select using (true);

grant select on public.world_flags to anon, authenticated;


-- ── 5. BAN ENFORCEMENT (server-side, RLS-independent of the client's forced sign-out) ─────────
create or replace function public.current_user_banned()
returns boolean language sql stable as $$
  select coalesce((select is_banned from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "progress_all_own" on public.user_progress;
create policy "progress_all_own" on public.user_progress
  for all using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

drop policy if exists "attempts_own" on public.sign_attempts;
create policy "attempts_own" on public.sign_attempts
  for all using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

-- sign_verification_log has existed live since Phase D but was never captured as its own
-- timestamped migration — it's only (re-)declared two migrations later in
-- 20260709010000_security_hardening.sql. That migration's own comment claims this is "a no-op
-- against the current live database and only matters for a from-scratch rebuild" — true for the
-- live database, false for a from-scratch rebuild: migrations replay in filename order, so THIS
-- file still runs first and fails immediately trying to policy a table that doesn't exist yet
-- (found 2026-08-04, first time the multiplayer CI job ever ran a genuinely fresh `supabase db reset`).
-- Idempotent `if not exists` duplicated here rather than reordering migration files, which would
-- disturb the already-reconciled production ledger for no benefit — a table create is safe to
-- repeat, a migration renumber is not.
create table if not exists public.sign_verification_log (
  id              bigint generated always as identity primary key,
  user_id         uuid references public.profiles on delete cascade not null,
  sign_id         text        not null,
  decision        text        check (decision in ('pass', 'veto', 'no-classifier')) not null,
  param_scores    jsonb       not null,
  classifier_vote jsonb,
  logged_at       timestamptz default now()
);

alter table public.sign_verification_log enable row level security;

drop policy if exists "verification_log_own" on public.sign_verification_log;
create policy "verification_log_own" on public.sign_verification_log
  for all using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

drop policy if exists "training_samples_own" on public.training_samples;
create policy "training_samples_own" on public.training_samples
  for all using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

drop policy if exists "friendships_insert_requester" on public.friendships;
create policy "friendships_insert_requester" on public.friendships
  for insert with check (auth.uid() = requester_id and not public.current_user_banned());

drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee" on public.friendships
  for update using (auth.uid() = addressee_id and not public.current_user_banned());

-- profiles itself: a banned user can still be READ (usernames stay visible on leaderboards/
-- friend lists) but can no longer edit their own row (e.g. renaming to evade recognition).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id and not public.current_user_banned());


-- ── 6. ADMIN RPC FUNCTIONS ────────────────────────────────────
-- Every function re-checks is_admin itself (never trust that only the UI calls these) and writes
-- one admin_audit_log row. This is the ONLY path that can touch another user's progress/ban
-- status — no RLS policy grants that broadly.

create or replace function public.admin_grant_gold(
  target_user_id uuid, amount int, reason text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
  new_gold int;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.user_progress
    set gold = greatest(0, gold + amount)
    where user_id = target_user_id
    returning gold into new_gold;

  if new_gold is null then
    raise exception 'target user has no progress row';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, payload)
    values (
      auth.uid(), 'grant_gold', target_user_id,
      jsonb_build_object('amount', amount, 'reason', reason, 'new_balance', new_gold)
    );

  return new_gold;
end;
$$;


create or replace function public.admin_set_cosmetic(
  target_user_id uuid, cosmetic_type text, item_id text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if cosmetic_type not in ('border', 'avatar') then
    raise exception 'invalid cosmetic_type: %', cosmetic_type;
  end if;

  if cosmetic_type = 'border' then
    update public.user_progress set
      equipped_border = item_id,
      owned_cosmetics = case
        when item_id is not null and not (item_id = any(owned_cosmetics))
          then owned_cosmetics || item_id
        else owned_cosmetics
      end
    where user_id = target_user_id;
  else
    update public.user_progress set
      equipped_avatar = item_id,
      owned_cosmetics = case
        when item_id is not null and not (item_id = any(owned_cosmetics))
          then owned_cosmetics || item_id
        else owned_cosmetics
      end
    where user_id = target_user_id;
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, payload)
    values (
      auth.uid(), 'set_cosmetic', target_user_id,
      jsonb_build_object('cosmetic_type', cosmetic_type, 'item_id', item_id)
    );
end;
$$;


create or replace function public.admin_grant_cosmetics(
  target_user_id uuid, item_ids text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.user_progress
    set owned_cosmetics = (
      select array_agg(distinct x) from unnest(owned_cosmetics || item_ids) as x
    )
    where user_id = target_user_id;

  insert into public.admin_audit_log (admin_id, action, target_user_id, payload)
    values (auth.uid(), 'grant_cosmetics', target_user_id, jsonb_build_object('item_ids', item_ids));
end;
$$;


create or replace function public.admin_set_ban(
  target_user_id uuid, banned boolean, reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot ban yourself';
  end if;

  update public.profiles set
    is_banned = banned,
    ban_reason = case when banned then reason else null end
  where id = target_user_id;

  insert into public.admin_audit_log (admin_id, action, target_user_id, payload)
    values (
      auth.uid(), case when banned then 'ban' else 'unban' end, target_user_id,
      jsonb_build_object('reason', reason)
    );
end;
$$;


create or replace function public.admin_get_user_progress(target_user_id uuid)
returns table (
  user_id uuid, xp int, level int, streak int, gold int,
  owned_cosmetics text[], equipped_border text, equipped_avatar text,
  is_banned boolean, ban_reason text
)
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
    select up.user_id, up.xp, up.level, up.streak, up.gold,
           up.owned_cosmetics, up.equipped_border, up.equipped_avatar,
           p.is_banned, p.ban_reason
    from public.user_progress up
    join public.profiles p on p.id = up.user_id
    where up.user_id = target_user_id;
end;
$$;


create or replace function public.admin_set_world_flag(
  p_world_id text, p_enabled boolean, p_coming_soon boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.world_flags (world_id, enabled, coming_soon, updated_by, updated_at)
    values (p_world_id, p_enabled, p_coming_soon, auth.uid(), now())
    on conflict (world_id) do update
      set enabled = excluded.enabled, coming_soon = excluded.coming_soon,
          updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.admin_audit_log (admin_id, action, target_user_id, payload)
    values (
      auth.uid(), 'set_world_flag', null,
      jsonb_build_object('world_id', p_world_id, 'enabled', p_enabled, 'coming_soon', p_coming_soon)
    );
end;
$$;

grant execute on function public.admin_grant_gold(uuid, int, text)         to authenticated;
grant execute on function public.admin_set_cosmetic(uuid, text, text)      to authenticated;
grant execute on function public.admin_grant_cosmetics(uuid, text[])       to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean, text)        to authenticated;
grant execute on function public.admin_get_user_progress(uuid)             to authenticated;
grant execute on function public.admin_set_world_flag(text, boolean, boolean) to authenticated;
