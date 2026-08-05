-- Additive extension of admin_beta_metrics(): previous-period figures so the in-app Admin Overview
-- can show plain-English "since yesterday" trends (users up/down, recognition accuracy up/down)
-- without any new tables or client-side access to RLS-locked data. Read-only, admin-only, derived
-- entirely from the existing timestamped sign_attempts rows. New JSON fields only — existing fields
-- and every caller keep working unchanged.
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
    'users', (
      select jsonb_build_object(
        'total', (select count(*) from public.profiles),
        'dau', (select count(distinct user_id) from public.sign_attempts
                where attempted_at >= now() - interval '1 day'),
        'wau', (select count(distinct user_id) from public.sign_attempts
                where attempted_at >= now() - interval '7 days'),
        -- previous day (the 24h window before the current one) for the "since yesterday" trend
        'dau_prev', (select count(distinct user_id) from public.sign_attempts
                where attempted_at >= now() - interval '2 days'
                  and attempted_at <  now() - interval '1 day')
      )
    ),
    'recognition', (
      select jsonb_build_object(
        'attempts_total', count(*),
        'attempts_24h', count(*) filter (where attempted_at >= now() - interval '1 day'),
        'attempts_prev_24h', count(*) filter (where attempted_at >= now() - interval '2 days'
                                                and attempted_at <  now() - interval '1 day'),
        'pass_rate', round(avg((passed)::int)::numeric, 4),
        -- windowed pass rates for the trend (current 24h vs the 24h before)
        'pass_rate_24h', round(avg((passed)::int) filter (where attempted_at >= now() - interval '1 day')::numeric, 4),
        'pass_rate_prev_24h', round(avg((passed)::int) filter (where attempted_at >= now() - interval '2 days'
                                                                 and attempted_at <  now() - interval '1 day')::numeric, 4),
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
