// Supabase-shaped bootstrap for PGlite: roles, auth schema, auth.uid(), realtime shim.
// Mirrors what Supabase provisions before any project migration runs, so the repo's own
// migrations can be applied unmodified and their RLS policies exercised for real.
export const BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_admin login superuser;

create schema if not exists auth;
create schema if not exists realtime;
create schema if not exists extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);

-- Supabase derives auth.uid() from the request JWT claims GUC. Same mechanism here, so
-- "set local request.jwt.claims" switches identity exactly as a real PostgREST request does.
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid;
$fn$;

create or replace function auth.role() returns text language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', 'anon');
$fn$;

-- Realtime authorization surface used by 20260718010000.
create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  payload jsonb
);
create or replace function realtime.topic() returns text language sql stable as $fn$
  select current_setting('realtime.topic', true);
$fn$;
alter table realtime.messages enable row level security;


-- pg_cron shim. The real extension is unavailable in PGlite, and four migrations call
-- cron.schedule() for background cleanup jobs. Those jobs are OUT OF SCOPE for authorization
-- testing (they run as the cron superuser, not as a client role), but the migrations containing
-- them also define real RLS policies and functions that ARE in scope -- notably 20260719000000's
-- members_select_own. Stubbing cron lets those migrations apply intact, so the policies under
-- test are the real ones rather than silently missing.
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(job_name text, schedule text, command text)
returns bigint language sql as $fn$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid;
$fn$;
create or replace function cron.unschedule(job_name text) returns boolean language sql as $fn$
  delete from cron.job where jobname = job_name; select true;
$fn$;

grant usage on schema public, auth, realtime, extensions to anon, authenticated, service_role;
grant all on all tables in schema realtime to anon, authenticated, service_role;

-- Supabase's default privileges: new objects in public are granted to anon/authenticated.
-- This is load-bearing for the audit: it is WHY an over-broad RLS policy is directly
-- exploitable rather than merely untidy.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;
