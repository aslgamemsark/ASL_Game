alter table public.sign_attempts
  add column if not exists outcome text,
  add column if not exists not_scorable_reason text,
  add column if not exists quality_metrics jsonb;

update public.sign_attempts
set outcome = case when passed then 'PASS' else 'NEEDS_CORRECTION' end
where outcome is null;

alter table public.sign_attempts
  add constraint sign_attempts_outcome_check
  check (outcome is null or outcome in ('PASS', 'NEEDS_CORRECTION', 'NOT_SCORABLE')) not valid;

alter table public.sign_attempts
  validate constraint sign_attempts_outcome_check;
