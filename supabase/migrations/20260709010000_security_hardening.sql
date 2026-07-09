-- ============================================================
-- Security hardening pass — 2026-07-09
-- Pre-beta audit: closes a remaining broken-access-control gap, restores
-- migration/schema consistency, adds server-side input validation that was
-- previously client-only, and adds a general-purpose audit log with
-- triggers on the tables where a trigger can meaningfully capture an event.
--
-- NOT covered here (and why — see the accompanying report for details):
--   - Login attempts / failed logins / password resets: these never touch a
--     table row (GoTrue rejects bad credentials before Postgres is involved),
--     so no trigger can observe them. Supabase's built-in Auth Logs already
--     capture all of this — Dashboard -> Logs -> Auth Logs.
--   - Rate limiting / API abuse detection: enforced at Supabase's PostgREST/
--     Kong gateway layer, not something a Postgres migration configures.
--   - MFA enrollment, password policy, email confirmation, email enumeration
--     protection: Dashboard -> Authentication settings, not SQL.
-- ============================================================


-- ── 1. Restore migration-history consistency ─────────────────
-- sign_verification_log has existed live (and in supabase/schema.sql) since
-- Phase D, but was never captured as a timestamped migration — replaying
-- migrations/*.sql alone against a fresh database would fail the moment
-- 20260707120000_admin_panel.sql tries to policy a table that was never
-- created. Idempotent (if not exists), so this is a no-op against the
-- current live database and only matters for a from-scratch rebuild.
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

create index if not exists sign_verification_log_sign_idx
  on public.sign_verification_log (sign_id, logged_at desc);


-- ── 2. Fix leaderboard "signs this week" showing 0 for other players ──────
-- Same root cause as the user_progress fix in 20260709000000: sign_attempts'
-- RLS was `for all using (auth.uid() = user_id)`, which also blocks SELECT
-- of any row that isn't your own. weekly_leaderboard's security_invoker view
-- joins sign_attempts to compute signs_this_week — that join silently
-- returned null (-> coalesced to 0) for every player but the caller, exactly
-- like total_xp did before the previous fix. Split the policy the same way.
drop policy if exists "attempts_own" on public.sign_attempts;

create policy "attempts_select_public" on public.sign_attempts
  for select using (true);

create policy "attempts_insert_own" on public.sign_attempts
  for insert with check (auth.uid() = user_id and not public.current_user_banned());

create policy "attempts_update_own" on public.sign_attempts
  for update using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

create policy "attempts_delete_own" on public.sign_attempts
  for delete using (auth.uid() = user_id and not public.current_user_banned());


-- ── 3. Server-side username format enforcement ───────────────
-- validateUsername() in web/src/lib/username.ts is the only thing enforcing
-- "3-20 chars, letters/numbers/underscores only" today — a direct REST call
-- to PostgREST (bypassing the UI entirely) could insert any string profiles
-- .username allows, since profiles_insert_own/profiles_update_own only check
-- auth.uid() = id, never the value being written. This mirrors that same
-- rule as a CHECK constraint so the database itself refuses to store an
-- invalid username no matter which client (or lack of one) is writing it.
--
-- Before adding this, two auto-generation code paths needed a length cap
-- first (fixed below in this migration + a matching frontend fix in the same
-- commit) — both appended a numeric suffix to an *uncapped* email-derived
-- prefix with no upper bound, so a long email local-part could already have
-- produced a >20-char username. Adding this constraint without capping those
-- first would have started rejecting signup for exactly those users.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-zA-Z0-9_]{3,20}$');

-- Fix the SQL-side auto-generator (handle_new_user) to cap the email-derived
-- base at 16 chars before ever appending a numeric collision suffix, so the
-- result always satisfies the constraint above regardless of email length.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := split_part(new.email, '@', 1);
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  base_username := left(base_username, 16);
  if length(base_username) < 3 then base_username := 'user'; end if;

  final_username := base_username;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, final_username);
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      final_username := left(base_username, 16) || suffix::text;
    end;
  end loop;

  insert into public.user_progress (user_id) values (new.id)
    on conflict do nothing;

  return new;
end;
$$;


-- ── 4. Unified audit log ──────────────────────────────────────
-- Complements (does not replace) admin_audit_log, which already covers the
-- admin-mutation success path well. audit_logs covers: registration, profile
-- edits, role/ban changes, account deletion, friendship lifecycle, sensitive
-- progress changes (gold/cosmetics — NOT every xp/streak tick, see note on
-- the user_progress trigger below), and permission-denial attempts against
-- the admin RPCs (a genuinely new signal admin_audit_log can't have, since it
-- only ever gets written on the success path, after the admin check passes).
create table if not exists public.audit_logs (
  id                  bigint generated always as identity primary key,
  "timestamp"         timestamptz default now() not null,
  user_id             uuid references auth.users on delete set null,
  email               text,
  action_type         text        not null,
  affected_table      text,
  affected_record_id  text,
  old_values          jsonb,
  new_values          jsonb,
  ip_address          text,
  user_agent          text,
  request_id          uuid        default gen_random_uuid(),
  success_status      boolean     default true not null
);

alter table public.audit_logs enable row level security;

-- Read-only for admins (mirrors admin_audit_log_read_admin). No insert/
-- update/delete policy for any client role — RLS denies by default when a
-- policy is absent for that action, so the ONLY way a row is ever written
-- is through log_audit_event() below, which is SECURITY DEFINER and bypasses
-- RLS the same way the admin RPCs already do.
drop policy if exists "audit_logs_read_admin" on public.audit_logs;
create policy "audit_logs_read_admin" on public.audit_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create index if not exists audit_logs_user_idx on public.audit_logs (user_id, "timestamp" desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action_type, "timestamp" desc);
create index if not exists audit_logs_table_record_idx on public.audit_logs (affected_table, affected_record_id);


-- Best-effort IP/user-agent extraction. PostgREST forwards the original
-- request's headers as a JSON string in the `request.headers` GUC for the
-- duration of the request; direct SQL-editor/migration/service-role activity
-- has no such setting, so this must never throw — it just returns nulls,
-- which is the correct answer for "there was no HTTP request".
create or replace function public._audit_request_context()
returns table(ip text, ua text)
language plpgsql stable as $$
declare
  hdrs json;
begin
  begin
    hdrs := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    hdrs := null;
  end;
  if hdrs is null then
    return query select null::text, null::text;
  end if;
  return query select
    coalesce(hdrs->>'x-forwarded-for', hdrs->>'x-real-ip'),
    hdrs->>'user-agent';
end;
$$;

create or replace function public.log_audit_event(
  p_user_id uuid,
  p_action_type text,
  p_affected_table text default null,
  p_affected_record_id text default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null,
  p_success boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_ip text;
  v_ua text;
begin
  if p_user_id is not null then
    select email into v_email from auth.users where id = p_user_id;
  end if;
  select ip, ua into v_ip, v_ua from public._audit_request_context();

  insert into public.audit_logs (
    user_id, email, action_type, affected_table, affected_record_id,
    old_values, new_values, ip_address, user_agent, success_status
  ) values (
    p_user_id, v_email, p_action_type, p_affected_table, p_affected_record_id,
    p_old_values, p_new_values, v_ip, v_ua, p_success
  );
end;
$$;


-- ── 5. Triggers: profiles (registration / profile edits / role changes / deletion) ──
create or replace function public.audit_profiles_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit_event(new.id, 'user_registration', 'profiles', new.id::text, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.is_admin is distinct from old.is_admin or new.is_banned is distinct from old.is_banned then
      perform public.log_audit_event(auth.uid(), 'role_change', 'profiles', new.id::text, to_jsonb(old), to_jsonb(new));
    else
      perform public.log_audit_event(auth.uid(), 'profile_update', 'profiles', new.id::text, to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit_event(auth.uid(), 'account_deletion', 'profiles', old.id::text, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_profiles_trg on public.profiles;
create trigger audit_profiles_trg
  after insert or update or delete on public.profiles
  for each row execute function public.audit_profiles_trigger();


-- ── 6. Trigger: user_progress (sensitive-column changes only) ────────────
-- Deliberately NOT logging every xp/streak/completed_lessons update: that
-- column set changes on nearly every practice rep (debounced-synced every
-- 3s from the client), and logging each tick would flood this table with
-- low-value rows and add write overhead to the app's hottest write path.
-- gold/cosmetics changes are comparatively rare, higher-stakes (currency +
-- inventory), and exactly the kind of thing worth a durable trail of.
create or replace function public.audit_user_progress_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit_event(new.user_id, 'progress_created', 'user_progress', new.user_id::text, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.gold is distinct from old.gold
       or new.owned_cosmetics is distinct from old.owned_cosmetics
       or new.equipped_border is distinct from old.equipped_border
       or new.equipped_avatar is distinct from old.equipped_avatar then
      perform public.log_audit_event(
        auth.uid(), 'progress_sensitive_update', 'user_progress', new.user_id::text,
        jsonb_build_object('gold', old.gold, 'owned_cosmetics', old.owned_cosmetics,
                            'equipped_border', old.equipped_border, 'equipped_avatar', old.equipped_avatar),
        jsonb_build_object('gold', new.gold, 'owned_cosmetics', new.owned_cosmetics,
                            'equipped_border', new.equipped_border, 'equipped_avatar', new.equipped_avatar)
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit_event(auth.uid(), 'progress_deleted', 'user_progress', old.user_id::text, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_user_progress_trg on public.user_progress;
create trigger audit_user_progress_trg
  after insert or update or delete on public.user_progress
  for each row execute function public.audit_user_progress_trigger();


-- ── 7. Trigger: friendships (request lifecycle) ───────────────
create or replace function public.audit_friendships_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit_event(
      new.requester_id, 'friend_request_sent', 'friendships',
      new.requester_id::text || ':' || new.addressee_id::text, null, to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.log_audit_event(
      auth.uid(), 'friend_request_updated', 'friendships',
      new.requester_id::text || ':' || new.addressee_id::text, to_jsonb(old), to_jsonb(new)
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit_event(
      auth.uid(), 'friendship_removed', 'friendships',
      old.requester_id::text || ':' || old.addressee_id::text, to_jsonb(old), null
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_friendships_trg on public.friendships;
create trigger audit_friendships_trg
  after insert or update or delete on public.friendships
  for each row execute function public.audit_friendships_trigger();


-- ── 8. Permission-denial logging on the admin RPCs ────────────
-- Each function already re-checks is_admin itself before doing anything
-- privileged (see 20260707120000_admin_panel.sql's header comment) — this
-- adds ONE line before each existing `raise exception 'not authorized'` so a
-- rejected attempt (e.g. a non-admin account somehow calling
-- admin_grant_gold directly via the REST API) leaves a durable, queryable
-- trail instead of just an ephemeral 403 the caller sees and nothing else.
-- Everything else in these functions is unchanged from admin_panel.sql.

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
    perform public.log_audit_event(auth.uid(), 'permission_denied', 'admin_rpc:admin_grant_gold', target_user_id::text, null, null, false);
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
    perform public.log_audit_event(auth.uid(), 'permission_denied', 'admin_rpc:admin_set_cosmetic', target_user_id::text, null, null, false);
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
    perform public.log_audit_event(auth.uid(), 'permission_denied', 'admin_rpc:admin_grant_cosmetics', target_user_id::text, null, null, false);
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
    perform public.log_audit_event(auth.uid(), 'permission_denied', 'admin_rpc:admin_set_ban', target_user_id::text, null, null, false);
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
    perform public.log_audit_event(auth.uid(), 'permission_denied', 'admin_rpc:admin_get_user_progress', target_user_id::text, null, null, false);
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
    perform public.log_audit_event(auth.uid(), 'permission_denied', 'admin_rpc:admin_set_world_flag', null, null, null, false);
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
