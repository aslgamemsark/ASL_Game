-- ============================================================
-- Feedback / bug reports — 2026-07-16
--
-- In-app replacement for the Settings "Report a bug" mailto: link. A mailto: hands off to
-- whatever the OS/browser has registered as the mail handler — in practice a Google account
-- chooser + Gmail compose, or nothing at all if no handler is set — which reads as broken. This
-- table lets the app collect feedback directly, with no dependency on a working mail client.
--
-- Guests (anonymous, no Supabase session → role `anon`) can submit too: feedback shouldn't
-- require an account. A submission may be anonymous (user_id null) or self-attributed, never
-- attributed to someone else. Only admins can read submissions back out.
-- ============================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  category text not null default 'general' check (category in ('bug', 'idea', 'general')),
  message text not null check (char_length(message) between 1 and 4000),
  user_agent text,
  created_at timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Explicit base grant (don't rely solely on Supabase default privileges) so the anon role can
-- insert; RLS below still constrains WHAT it may insert.
grant insert on public.feedback to anon, authenticated;

-- Anyone may submit; they may only attribute a submission to themselves or leave it anonymous.
create policy "feedback_insert_any" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Only admins can read feedback back out.
create policy "feedback_select_admin" on public.feedback
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
