-- ============================================================
-- User reports — flag an offensive/inappropriate username for review.
-- Mirrors the friendships table's participant-scoped RLS pattern (schema.sql).
-- Run in Supabase Dashboard → SQL Editor.
--
-- REVIEW SURFACE: there is no admin UI for this yet — review new rows directly in the
-- Supabase Table Editor (user_reports, sorted by created_at desc). Remediate a bad username
-- with a manual `update public.profiles set username = 'signer_' || substr(md5(random()::text), 1, 6)
-- where id = '<reported_id>'`.
-- ============================================================

create table if not exists public.user_reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid references public.profiles on delete cascade not null,
  reported_id  uuid references public.profiles on delete cascade not null,
  reason       text not null check (reason in ('offensive', 'impersonation', 'spam', 'other')),
  note         text,
  context      text,   -- where it was seen: 'leaderboard' | 'friends' | 'multiplayer'
  created_at   timestamptz default now(),
  constraint user_reports_not_self check (reporter_id <> reported_id),
  -- One open report per (reporter, reported) pair — stops a single user from spamming reports
  -- against the same target; they can still report different users.
  unique (reporter_id, reported_id)
);

alter table public.user_reports enable row level security;

-- Reporters can insert (only as themselves, never targeting themselves) and read back their own
-- submitted reports (e.g. to show "already reported"). No one can read reports made AGAINST them
-- — that would let a reported user see who flagged them.
drop policy if exists "reports_insert_own" on public.user_reports;
create policy "reports_insert_own" on public.user_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "reports_select_own" on public.user_reports;
create policy "reports_select_own" on public.user_reports
  for select using (auth.uid() = reporter_id);

create index if not exists user_reports_reported_idx
  on public.user_reports (reported_id, created_at desc);
