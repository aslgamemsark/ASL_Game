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


-- ── 3b. SIGN VERIFICATION LOG ───────────────────────────────
-- Per-parameter score breakdown + classifier vote for every rule-verifier PASS or VETO event
-- (not every fail — that's every other frame). Distinct from sign_attempts (which is just a
-- pass/fail boolean for the leaderboard): this is telemetry for finding real false-pass edge
-- cases from actual play — a rule-pass the classifier disagreed with (even below veto
-- threshold) is exactly the "minor edge case" signal that a single manual calibration session
-- can't surface. Never carries video/landmarks, only the already-computed numeric scores —
-- consistent with the project's "recognition stays on-device" rule.
create table if not exists public.sign_verification_log (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.profiles on delete cascade not null,
  sign_id      text        not null,
  decision     text        check (decision in ('pass', 'veto', 'no-classifier')) not null,
  param_scores jsonb       not null,   -- ParamScore[]: [{name, score, threshold, required}, ...]
  classifier_vote jsonb,               -- {topSign, confidence, perSign} or null (no model / disabled)
  logged_at    timestamptz default now()
);

alter table public.sign_verification_log enable row level security;

create policy "verification_log_own" on public.sign_verification_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists sign_verification_log_sign_idx
  on public.sign_verification_log (sign_id, logged_at desc);


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
