-- ============================================================
-- Security hardening — 2026-07-06
-- Addresses findings in docs/security/SECURITY_AUDIT.md.
-- Idempotent: safe to re-run against the live DB.
-- Run in Supabase SQL Editor (or via the migration pipeline).
--
-- SCOPE / HONESTY NOTE: this migration hardens what SQL/RLS can enforce server-side. It does NOT
-- (and cannot) make scores fully server-authoritative — that needs an Edge Function / SECURITY
-- DEFINER RPC that becomes the ONLY writer of sign_attempts/user_progress (VULN-01, VULN-02
-- rewards). The CHECK constraints + rate limits below are partial mitigations that raise the cost
-- of the crudest abuse; they are not a substitute for the server-authoritative rewrite.
-- ============================================================


-- ── VULN-04: training-data collection defaults to OFF (opt-in) ──────────────
-- Existing rows keep their current value; only NEW profiles default to false.
alter table public.profiles
  alter column collect_training_data set default false;


-- ── VULN-03: neutral generated usernames (stop deriving from the email) ─────
-- Old behavior leaked the email local-part as a world-readable username. New users get an
-- opaque handle like "signer_4f9a2c"; they can still set a chosen display username at signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  final_username text;
  attempts int := 0;
begin
  loop
    -- 6 random lowercase-hex-ish chars; collision-retry against the UNIQUE constraint.
    final_username := 'signer_' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    begin
      insert into public.profiles (id, username) values (new.id, final_username);
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 10 then
        -- Extremely unlikely; fall back to a longer handle to guarantee termination.
        final_username := 'signer_' || substr(md5(new.id::text), 1, 12);
        insert into public.profiles (id, username) values (new.id, final_username);
        exit;
      end if;
    end;
  end loop;

  insert into public.user_progress (user_id) values (new.id)
    on conflict do nothing;

  return new;
end;
$$;
-- Trigger already exists (on_auth_user_created); CREATE OR REPLACE FUNCTION above is enough.


-- ── VULN-01 (partial): sanity CHECK constraints on client-written progress ──
-- Rejects the crudest forgeries (negative or absurd values). Does NOT stop a determined cheater
-- from setting plausible-but-fake numbers — that requires server-authoritative writes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_progress_sane') then
    alter table public.user_progress add constraint user_progress_sane check (
      xp >= 0 and xp <= 100000000
      and level >= 1 and level <= 1000
      and streak >= 0 and streak <= 100000
      and longest_streak >= 0 and longest_streak <= 100000
    );
  end if;
end $$;


-- ── VULN-06: per-user insert rate limits (server-enforced, RLS-independent) ──
-- A BEFORE INSERT trigger counts the user's recent rows and rejects floods. Budgets are far above
-- normal play (a real attempt is seconds long) so legitimate users never hit them; they only cap
-- scripted abuse that would blow up cost or poison the training set.
create or replace function public.enforce_insert_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  budget int;
  window_start timestamptz := now() - interval '1 minute';
begin
  if tg_table_name = 'training_samples' then
    budget := 60;   -- ~1/sec sustained; normal play is far lower
    select count(*) into recent_count from public.training_samples
      where user_id = new.user_id and created_at > window_start;
  elsif tg_table_name = 'sign_attempts' then
    budget := 120;  -- attempts are quick; still generous
    select count(*) into recent_count from public.sign_attempts
      where user_id = new.user_id and attempted_at > window_start;
  else
    return new;
  end if;

  if recent_count >= budget then
    raise exception 'rate limit exceeded for % (max % per minute)', tg_table_name, budget
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists training_samples_rate_limit on public.training_samples;
create trigger training_samples_rate_limit
  before insert on public.training_samples
  for each row execute function public.enforce_insert_rate_limit();

drop trigger if exists sign_attempts_rate_limit on public.sign_attempts;
create trigger sign_attempts_rate_limit
  before insert on public.sign_attempts
  for each row execute function public.enforce_insert_rate_limit();


-- ── VULN-06 (poisoning guard): reject obviously-malformed training frames ────
-- frames must be a non-empty JSON array. Cheap shape check; keeps junk out of the dataset.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'training_samples_frames_shape') then
    alter table public.training_samples add constraint training_samples_frames_shape check (
      jsonb_typeof(frames) = 'array' and jsonb_array_length(frames) > 0
    );
  end if;
end $$;
