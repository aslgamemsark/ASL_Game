-- Beta feedback / "Report a Problem" — 2026-07-15
-- Distinct from user_reports (which is for reporting other USERS). This is app-level feedback:
-- bug reports, feature requests, and general notes from beta testers. Anonymous option = a
-- signed-in tester can submit without attaching their identity (user_id null). Reads are
-- admin-only (reviewed in the beta admin dashboard); inserts are self-service. Applied to
-- production via the Supabase connector on 2026-07-15; this file mirrors it for replay parity.
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles on delete set null,  -- null when submitted anonymously
  category    text not null check (category in ('bug','feature','other')),
  message     text not null check (char_length(message) between 1 and 4000),
  anonymous   boolean not null default false,
  page        text,          -- which screen the tester was on (auto-captured)
  user_agent  text,          -- browser/device string (auto-captured, helps reproduce)
  app_version text,          -- build/version marker if available
  status      text not null default 'open' check (status in ('open','triaged','resolved','wontfix')),
  created_at  timestamptz default now()
);

alter table public.feedback enable row level security;

-- Insert: a signed-in tester can file feedback as themselves, OR anonymously (user_id null).
-- The check enforces those are the only two shapes — you can't file feedback "as" someone else.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check ( (anonymous is true and user_id is null) or (auth.uid() = user_id) );

-- Read: admins only (feedback may contain personal context; reviewed in the admin dashboard).
drop policy if exists feedback_read_admin on public.feedback;
create policy feedback_read_admin on public.feedback for select to authenticated
  using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) );

-- Update: admins only (to set triage status).
drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback for update to authenticated
  using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) );

grant insert, select, update on public.feedback to authenticated;

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status) where status = 'open';
