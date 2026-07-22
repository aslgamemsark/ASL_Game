-- ============================================================
-- Admin analytics dashboard metrics — 2026-07-23
-- One SECURITY DEFINER read-only aggregate powering the AdminPanel "Analytics" tab. Like
-- admin_beta_metrics, the raw tables (profiles, sign_attempts, user_progress) are per-user
-- RLS-locked, so an admin client can't SELECT across all rows to build time-series/cohort stats
-- — this function aggregates server-side behind the same is_admin gate as every other admin_* RPC
-- and returns a single jsonb blob so the dashboard is one round-trip.
--
-- Honest scope (mirrors what's actually in Postgres): "active" means "filed at least one
-- sign_attempt" — the only per-user activity timestamp we store. Logins, screen views, onboarding
-- funnel and traffic source live only in PostHog and are NOT queryable here. Guests have no row at
-- all, so every count is registered-users-only. Region is populated best-effort client-side, so a
-- meaningful share of users land in the 'Unknown' bucket.
--
-- All time bucketing is done in UTC (`ts AT TIME ZONE 'UTC'`) so results are deterministic
-- regardless of the DB session timezone (project rule: store/compare time in UTC).
-- Read-only: no mutation, so no audit-log row. Idempotent.
-- ============================================================

create or replace function public.admin_analytics(p_days int default 90)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
  v_days int;
  result jsonb;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Clamp the window so a bad/hostile client value can't request an unbounded scan.
  v_days := least(greatest(coalesce(p_days, 90), 1), 365);

  result := jsonb_build_object(
    'generated_at', now(),
    'window_days', v_days,

    -- Signups per UTC day over the window, gap-filled so zero-signup days still appear, with a
    -- running cumulative total that starts from the real count of users who existed before the
    -- window (so the cumulative line is the true total, not a window-relative one).
    'growth', (
      with days as (
        select generate_series(
          (now() at time zone 'UTC')::date - (v_days - 1),
          (now() at time zone 'UTC')::date,
          interval '1 day'
        )::date as day
      ),
      signups as (
        select (created_at at time zone 'UTC')::date as day, count(*) as n
        from public.profiles
        group by 1
      ),
      base as (
        select count(*) as prior
        from public.profiles
        where (created_at at time zone 'UTC')::date < (select min(day) from days)
      ),
      -- Cumulative is a window function, which cannot be nested inside an aggregate (jsonb_agg),
      -- so it is materialized here first, then aggregated below.
      rows as (
        select
          d.day,
          coalesce(s.n, 0) as signups,
          (select prior from base) + sum(coalesce(s.n, 0)) over (order by d.day) as cumulative
        from days d
        left join signups s on s.day = d.day
      )
      select coalesce(jsonb_agg(
        jsonb_build_object('day', day, 'signups', signups, 'cumulative', cumulative)
        order by day
      ), '[]'::jsonb)
      from rows
    ),

    -- Distinct attempters per UTC day, gap-filled. This is the DAU series; the client derives the
    -- 7-day rolling WAU line from it to avoid a second table scan.
    'active', (
      with days as (
        select generate_series(
          (now() at time zone 'UTC')::date - (v_days - 1),
          (now() at time zone 'UTC')::date,
          interval '1 day'
        )::date as day
      ),
      dau as (
        select (attempted_at at time zone 'UTC')::date as day, count(distinct user_id) as n
        from public.sign_attempts
        where attempted_at >= now() - make_interval(days => v_days)
        group by 1
      )
      select coalesce(jsonb_agg(
        jsonb_build_object('day', d.day, 'dau', coalesce(a.n, 0)) order by d.day
      ), '[]'::jsonb)
      from days d
      left join dau a on a.day = d.day
    ),

    -- Weekly cohort retention (the retention triangle) for the last 8 signup-week cohorts.
    -- cohort_week = the UTC week a user signed up in; offset = whole weeks between that and a week
    -- in which they filed at least one attempt. active = distinct users in that (cohort, offset)
    -- cell. cohort_size is >= 1 by construction, so pct division is always safe.
    'retention', (
      with cohorts as (
        select
          id as user_id,
          (date_trunc('week', created_at at time zone 'UTC'))::date as cohort_week
        from public.profiles
      ),
      recent_cohorts as (
        select cohort_week
        from cohorts
        group by cohort_week
        order by cohort_week desc
        limit 8
      ),
      cohort_sizes as (
        select c.cohort_week, count(*) as cohort_size
        from cohorts c
        join recent_cohorts rc on rc.cohort_week = c.cohort_week
        group by c.cohort_week
      ),
      activity as (
        select
          c.cohort_week,
          (((date_trunc('week', sa.attempted_at at time zone 'UTC'))::date - c.cohort_week) / 7)::int
            as week_offset,
          count(distinct c.user_id) as active
        from cohorts c
        join recent_cohorts rc on rc.cohort_week = c.cohort_week
        join public.sign_attempts sa on sa.user_id = c.user_id
        where (date_trunc('week', sa.attempted_at at time zone 'UTC'))::date >= c.cohort_week
        group by c.cohort_week, 2
      ),
      -- Emit EVERY week a cohort has actually reached (0 .. weeks-since-signup), left-joining
      -- activity so a week with no active users becomes an explicit 0% rather than a blank —
      -- blanks are reserved for future weeks a cohort simply hasn't lived through yet.
      cells as (
        select
          cs.cohort_week,
          cs.cohort_size,
          o.week_offset,
          coalesce(a.active, 0) as active
        from cohort_sizes cs
        cross join lateral generate_series(
          0,
          greatest(0, ((now() at time zone 'UTC')::date - cs.cohort_week) / 7)
        ) as o(week_offset)
        left join activity a on a.cohort_week = cs.cohort_week and a.week_offset = o.week_offset
      )
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'cohort_week', cs.cohort_week,
          'cohort_size', cs.cohort_size,
          'weeks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'offset', ce.week_offset,
                'active', ce.active,
                'pct', round(ce.active::numeric / cs.cohort_size, 4)
              ) order by ce.week_offset
            )
            from cells ce
            where ce.cohort_week = cs.cohort_week
          ), '[]'::jsonb)
        ) order by cs.cohort_week desc
      ), '[]'::jsonb)
      from cohort_sizes cs
    ),

    -- Users by country. Region is best-effort and nullable, so NULL/'' collapse into 'Unknown'.
    'geography', (
      select coalesce(jsonb_agg(
        jsonb_build_object('region', region, 'users', n) order by n desc, region
      ), '[]'::jsonb)
      from (
        select coalesce(nullif(region, ''), 'Unknown') as region, count(*) as n
        from public.profiles
        group by 1
      ) g
    ),

    -- Engagement distributions across all users with a progress row: medians plus fixed-bucket
    -- histograms for level, streak, and lessons-completed.
    'engagement', (
      select jsonb_build_object(
        'total_with_progress', count(*),
        'median_level', coalesce(percentile_cont(0.5) within group (order by level), 0),
        'median_streak', coalesce(percentile_cont(0.5) within group (order by streak), 0),
        'median_xp', coalesce(percentile_cont(0.5) within group (order by xp), 0),
        'level_hist', jsonb_build_array(
          jsonb_build_object('bucket', 'Lv 1',    'count', count(*) filter (where level = 1)),
          jsonb_build_object('bucket', 'Lv 2-3',  'count', count(*) filter (where level between 2 and 3)),
          jsonb_build_object('bucket', 'Lv 4-5',  'count', count(*) filter (where level between 4 and 5)),
          jsonb_build_object('bucket', 'Lv 6-10', 'count', count(*) filter (where level between 6 and 10)),
          jsonb_build_object('bucket', 'Lv 11+',  'count', count(*) filter (where level >= 11))
        ),
        'streak_hist', jsonb_build_array(
          jsonb_build_object('bucket', '0',    'count', count(*) filter (where streak = 0)),
          jsonb_build_object('bucket', '1-2',  'count', count(*) filter (where streak between 1 and 2)),
          jsonb_build_object('bucket', '3-6',  'count', count(*) filter (where streak between 3 and 6)),
          jsonb_build_object('bucket', '7-13', 'count', count(*) filter (where streak between 7 and 13)),
          jsonb_build_object('bucket', '14+',  'count', count(*) filter (where streak >= 14))
        ),
        'lessons_hist', jsonb_build_array(
          jsonb_build_object('bucket', '0',    'count', count(*) filter (where cardinality(completed_lessons) = 0)),
          jsonb_build_object('bucket', '1-2',  'count', count(*) filter (where cardinality(completed_lessons) between 1 and 2)),
          jsonb_build_object('bucket', '3-5',  'count', count(*) filter (where cardinality(completed_lessons) between 3 and 5)),
          jsonb_build_object('bucket', '6-10', 'count', count(*) filter (where cardinality(completed_lessons) between 6 and 10)),
          jsonb_build_object('bucket', '11+',  'count', count(*) filter (where cardinality(completed_lessons) >= 11))
        )
      )
      from public.user_progress
    )
  );

  return result;
end;
$$;

revoke execute on function public.admin_analytics(int) from public;
revoke execute on function public.admin_analytics(int) from anon;
grant execute on function public.admin_analytics(int) to authenticated;
