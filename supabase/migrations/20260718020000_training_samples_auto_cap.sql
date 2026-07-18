-- Automatic safety cap on training_samples so a traffic spike can never fill the 500 MB free-tier
-- database and take down every write in the app. Trims the table to the newest 8,000 rows
-- (~260 MB at ~32 KB/row) every 15 minutes via pg_cron. This is a seatbelt under the manual
-- ml/export_training_samples.py drain — when the operator drains regularly it never fires; it only
-- acts if a spike outruns the drain, trading the oldest un-exported rows for keeping the app alive.
--
-- To change the cap: edit the LIMIT in trim_training_samples() (raise for more data / less safety
-- headroom, lower for the reverse). To pause: select cron.unschedule('trim-training-samples').

create extension if not exists pg_cron;

-- Range delete on the monotonic bigint id (fast, index-only): find the id of the 8,000th-newest
-- row and drop everything below it. With <= 8,000 rows the subquery's min is the table min, so
-- `id < min` matches nothing — a safe no-op until the table actually grows past the cap.
create or replace function public.trim_training_samples()
returns void
language sql
security definer
set search_path = public as $$
  delete from public.training_samples
  where id < (
    select min(id) from (
      select id from public.training_samples order by id desc limit 8000
    ) keep
  );
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'trim-training-samples') then
    perform cron.unschedule('trim-training-samples');
  end if;
end $$;

select cron.schedule('trim-training-samples', '*/15 * * * *', $$ select public.trim_training_samples(); $$);
