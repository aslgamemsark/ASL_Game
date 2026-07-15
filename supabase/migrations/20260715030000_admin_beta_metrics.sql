-- ============================================================
-- Beta admin dashboard metrics — 2026-07-15
-- One SECURITY DEFINER read-only aggregate powering the AdminPanel "Beta" tab. The raw tables
-- (sign_attempts, sign_verification_log, feedback) are per-user RLS-locked, so an admin client
-- can't SELECT across all rows to build cohort stats — this function does the aggregation server
-- side behind the same is_admin gate as every other admin_* RPC, and returns a single jsonb blob
-- so the dashboard is one round-trip (a deep call, not a dozen shallow queries from the client).
-- Read-only: no mutation, so no audit-log row (unlike the grant/ban/rename RPCs). Idempotent.
-- Applied to production via the Supabase connector on 2026-07-15; this file mirrors it.
-- ============================================================

create or replace function public.admin_beta_metrics()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
  result jsonb;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  result := jsonb_build_object(
    'generated_at', now(),

    -- Engagement. "Active" = filed at least one sign attempt in the window (the only per-user
    -- activity signal we timestamp). total_users is every profile, not just active ones.
    'users', (
      select jsonb_build_object(
        'total', (select count(*) from public.profiles),
        'dau', (select count(distinct user_id) from public.sign_attempts
                where attempted_at >= now() - interval '1 day'),
        'wau', (select count(distinct user_id) from public.sign_attempts
                where attempted_at >= now() - interval '7 days')
      )
    ),

    -- Recognition health across all attempts. Rates are computed only over rows where the relevant
    -- column is non-null (an attempt logged before the AI columns existed shouldn't count against
    -- the veto rate), so each denominator is stated alongside its rate.
    'recognition', (
      select jsonb_build_object(
        'attempts_total', count(*),
        'attempts_24h', count(*) filter (where attempted_at >= now() - interval '1 day'),
        'pass_rate', round(avg((passed)::int)::numeric, 4),
        'rule_reject_rate', round(
          avg((rule_passed = false)::int) filter (where rule_passed is not null)::numeric, 4),
        'rule_reject_denom', count(*) filter (where rule_passed is not null),
        'ai_veto_rate', round(
          avg((ai_vetoed = true)::int) filter (where ai_vetoed is not null)::numeric, 4),
        'ai_veto_denom', count(*) filter (where ai_vetoed is not null),
        'avg_ai_confidence', round(avg(ai_confidence) filter (where ai_confidence is not null), 4),
        'no_sign_count', count(*) filter (where ai_prediction = 'NO_SIGN')
      )
      from public.sign_attempts
    ),

    -- Signs testers struggle with most: ranked by failure count, restricted to signs with enough
    -- attempts that the fail-rate isn't noise. This is the "most failed/retried signs" beta metric.
    'top_failed_signs', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select
          sign_id,
          count(*) as attempts,
          count(*) filter (where passed = false) as failures,
          round(avg((passed = false)::int)::numeric, 3) as fail_rate
        from public.sign_attempts
        group by sign_id
        having count(*) >= 5
        order by count(*) filter (where passed = false) desc, count(*) desc
        limit 12
      ) t
    ),

    -- Feedback inbox summary (the full rows are read via the feedback_read_admin RLS policy; this
    -- is just the at-a-glance counts for the dashboard header).
    'feedback', (
      select jsonb_build_object(
        'total', count(*),
        'open', count(*) filter (where status = 'open'),
        'by_category', (
          select coalesce(jsonb_object_agg(category, c), '{}'::jsonb)
          from (select category, count(*) c from public.feedback group by category) x
        )
      )
      from public.feedback
    )
  );

  return result;
end;
$$;

revoke execute on function public.admin_beta_metrics() from public;
revoke execute on function public.admin_beta_metrics() from anon;
grant execute on function public.admin_beta_metrics() to authenticated;
