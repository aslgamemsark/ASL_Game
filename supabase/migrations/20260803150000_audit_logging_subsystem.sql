-- ============================================================
-- Audit-logging subsystem — extracted 2026-08-03, NOT YET APPLIED
--
-- The one genuinely-missing piece found while reconciling the migration ledger against production.
-- Migration 20260709010000_security_hardening was only PARTIALLY applied: its sign_attempts
-- policies, handle_new_user changes and progress guards are all live, but the entire audit-logging
-- half -- the audit_logs table, log_audit_event(), and the profiles/user_progress triggers -- does
-- not exist in the database. No application code reads audit_logs, which is why nothing ever
-- surfaced the absence: it is a security/compliance control (a durable trail of role and ban
-- changes, account deletion, and currency/cosmetic mutations), not a feature.
--
-- WHY THIS IS EXTRACTED RATHER THAN JUST RE-RUNNING THE ORIGINAL FILE:
-- 20260709010000 also contains `create policy "attempts_select_public" on public.sign_attempts`,
-- a world-readable policy DELIBERATELY replaced by attempts_select_own in
-- 20260718010000_realtime_authorization. Re-running the original file would silently restore it,
-- letting any anonymous visitor dump any user's full per-sign attempt history. Replaying an old
-- migration is not a safe way to recover a missing piece of it.
--
-- !! WHY THIS IS NOT APPLIED YET -- READ BEFORE APPLYING:
-- `audit_profiles_trg` fires AFTER INSERT on public.profiles, and profiles rows are created by the
-- handle_new_user trigger during sign-up. A trigger that raises there aborts the insert, which
-- would break REGISTRATION FOR EVERY NEW USER. That is not a risk worth taking blind, and it could
-- not be tested here (the local Supabase stack needs Docker, which the authoring machine lacks --
-- see docs/MULTIPLAYER_TESTING.md).
--
-- TO APPLY SAFELY:
--   1. `npm run supabase:start` (from web/) -- applies every migration including this one.
--   2. Register a brand-new account against the local stack. Confirm it SUCCEEDS, then confirm
--      `select * from public.audit_logs` holds a 'user_registration' row for it.
--   3. Confirm a gold/cosmetic change writes 'progress_sensitive_update', and that an ordinary
--      xp/streak tick writes NOTHING (the app's hottest write path is deliberately excluded).
--   4. Only then apply to production.
-- ============================================================

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
