-- ============================================================
-- ASL Game — Supabase Schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. PROFILES ─────────────────────────────────────────────
-- One row per user. Public-readable so leaderboard works.
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique not null,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_public"  on public.profiles for select using (true);
create policy "profiles_insert_own"     on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"     on public.profiles for update using (auth.uid() = id);


-- ── 2. USER PROGRESS ────────────────────────────────────────
-- Mirrors the Zustand store; upserted on every store change.
create table if not exists public.user_progress (
  user_id           uuid references public.profiles on delete cascade primary key,
  xp                integer      default 0   not null,
  level             integer      default 1   not null,
  streak            integer      default 0   not null,
  longest_streak    integer      default 0   not null,
  last_practice_date date,
  completed_lessons text[]       default '{}' not null,
  sign_accuracy     jsonb        default '{}' not null,
  updated_at        timestamptz  default now()
);

alter table public.user_progress enable row level security;

create policy "progress_all_own" on public.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 3. SIGN ATTEMPTS ────────────────────────────────────────
-- Raw attempt log — powers the leaderboard and is our future ML dataset.
create table if not exists public.sign_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.profiles on delete cascade not null,
  sign_id      text        not null,
  passed       boolean     not null,
  attempted_at timestamptz default now()
);

alter table public.sign_attempts enable row level security;

create policy "attempts_own" on public.sign_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index for the leaderboard query (week filter + user)
create index if not exists sign_attempts_week_idx
  on public.sign_attempts (user_id, attempted_at desc);


-- ── 4. FRIENDSHIPS ──────────────────────────────────────────
create table if not exists public.friendships (
  requester_id uuid references public.profiles on delete cascade,
  addressee_id uuid references public.profiles on delete cascade,
  status       text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at   timestamptz default now(),
  primary key (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "friendships_select_participant" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_insert_requester" on public.friendships
  for insert with check (auth.uid() = requester_id);
create policy "friendships_update_addressee" on public.friendships
  for update using (auth.uid() = addressee_id);
create policy "friendships_delete_participant" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);


-- ── 5. WEEKLY LEADERBOARD VIEW ──────────────────────────────
-- Public: signs passed in the current calendar week, ranked.
create or replace view public.weekly_leaderboard
  with (security_invoker = true)
as
select
  p.id,
  p.username,
  coalesce(
    count(sa.id) filter (
      where sa.passed
        and sa.attempted_at >= date_trunc('week', now())
    ), 0
  )::int                        as signs_this_week,
  coalesce(up.xp, 0)           as total_xp,
  coalesce(up.streak, 0)       as streak
from public.profiles p
left join public.user_progress up on up.user_id = p.id
left join public.sign_attempts sa on sa.user_id = p.id
group by p.id, p.username, up.xp, up.streak
order by signs_this_week desc, total_xp desc;

-- Grant anon + authenticated read on the view
grant select on public.weekly_leaderboard to anon, authenticated;


-- ── 6. AUTO-CREATE PROFILE ON SIGN-UP ───────────────────────
-- Trigger fires after a new auth.users row is inserted.
-- Username defaults to the part before @ in their email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := split_part(new.email, '@', 1);
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  if length(base_username) < 3 then base_username := 'user'; end if;

  final_username := base_username;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, final_username);
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
    end;
  end loop;

  insert into public.user_progress (user_id) values (new.id)
    on conflict do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- Phase D — Analytics + training-data collection
-- Idempotent: safe to re-run this whole file against the live DB.
-- ============================================================

-- ── 7. EXTEND sign_attempts WITH AI/RULE BREAKDOWN ──────────
-- Old rows stay valid: all-null on these columns means "no AI data" (pre-Phase-D behavior).
alter table public.sign_attempts add column if not exists rule_passed   boolean;
alter table public.sign_attempts add column if not exists ai_prediction text;
alter table public.sign_attempts add column if not exists ai_confidence numeric;
alter table public.sign_attempts add column if not exists ai_vetoed     boolean;


-- ── 8. TRAINING-DATA OPT-OUT FLAG ───────────────────────────
alter table public.profiles add column if not exists
  collect_training_data boolean default true not null;


-- ── 9. TRAINING SAMPLES ──────────────────────────────────────
-- One row per attempt where the user has training-data collection enabled. `frames` holds the
-- exact Frame[] landmark snapshot (same JSON shape `tools/extract_dataset.py` and
-- `web/src/engine/landmarks.ts` already produce) used for that gate decision — this is the
-- growing proprietary dataset for retraining (see tools/export_supabase_samples.py).
create table if not exists public.training_samples (
  id            bigint generated always as identity primary key,
  user_id       uuid references public.profiles on delete cascade not null,
  sign_id       text        not null,
  frames        jsonb       not null,
  rule_passed   boolean     not null,
  ai_prediction text,
  ai_confidence numeric,
  final_passed  boolean     not null,
  source        text        not null, -- 'lesson' | 'story' | 'practice' | 'speed'
  created_at    timestamptz default now()
);

alter table public.training_samples enable row level security;

-- CREATE POLICY has no IF NOT EXISTS — drop-then-create keeps this block re-runnable.
drop policy if exists "training_samples_own" on public.training_samples;
create policy "training_samples_own" on public.training_samples
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists training_samples_user_idx
  on public.training_samples (user_id, created_at desc);


-- ── 10. PERSONAL ANALYTICS VIEWS ─────────────────────────────
-- security_invoker = true means each view runs with the QUERYING user's permissions, so the
-- existing RLS policy on sign_attempts (auth.uid() = user_id) already scopes every view to
-- "my own data" — no cross-user leakage, no extra filtering needed.

create or replace view public.most_failed_signs
  with (security_invoker = true)
as
select
  sa.user_id,
  sa.sign_id,
  count(*) filter (where not sa.passed) as fail_count,
  count(*)                              as attempt_count
from public.sign_attempts sa
group by sa.user_id, sa.sign_id
order by fail_count desc;

create or replace view public.sign_attempt_stats
  with (security_invoker = true)
as
select
  sa.user_id,
  sa.sign_id,
  count(*)                              as attempts,
  count(*) filter (where sa.passed)     as passes,
  round(
    count(*)::numeric / nullif(count(*) filter (where sa.passed), 0), 2
  )                                      as avg_attempts_per_pass
from public.sign_attempts sa
group by sa.user_id, sa.sign_id;

create or replace view public.ai_veto_stats
  with (security_invoker = true)
as
select
  sa.user_id,
  count(*) filter (where sa.ai_prediction is not null) as ai_gated_attempts,
  count(*) filter (where sa.ai_vetoed)                 as veto_count,
  round(
    100.0 * count(*) filter (where sa.ai_vetoed) /
    nullif(count(*) filter (where sa.ai_prediction is not null), 0), 1
  )                                                     as veto_rate_pct
from public.sign_attempts sa
group by sa.user_id;

create or replace view public.daily_accuracy
  with (security_invoker = true)
as
select
  sa.user_id,
  date_trunc('day', sa.attempted_at)::date as day,
  count(*)                                 as attempts,
  count(*) filter (where sa.passed)        as passes,
  round(100.0 * count(*) filter (where sa.passed) / nullif(count(*), 0), 1) as pass_rate_pct
from public.sign_attempts sa
group by sa.user_id, date_trunc('day', sa.attempted_at)::date
order by day;

-- Personal insights — require auth (not exposed to anon like weekly_leaderboard).
grant select on public.most_failed_signs   to authenticated;
grant select on public.sign_attempt_stats  to authenticated;
grant select on public.ai_veto_stats       to authenticated;
grant select on public.daily_accuracy      to authenticated;
