alter table public.sign_attempts
  add column if not exists outcome text,
  add column if not exists not_scorable_reason text,
  add column if not exists quality_metrics jsonb,
  add column if not exists evidence_schema_version integer,
  add column if not exists recognition_version text;

update public.sign_attempts
set outcome = 'PASS'
where outcome is null and passed is true;

-- Legacy failures cannot distinguish genuine corrections from camera failures, so keep them NULL.

alter table public.sign_attempts
  add constraint sign_attempts_outcome_check
  check (outcome is null or outcome in ('PASS', 'NEEDS_CORRECTION', 'NOT_SCORABLE')) not valid;

alter table public.sign_attempts
  validate constraint sign_attempts_outcome_check;
