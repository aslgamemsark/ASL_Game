-- ============================================================
-- Region leaderboard + re-affirm the world-XP-shows-0 RLS fix.
--
-- 1. Adds profiles.region (ISO country code, e.g. "US"), populated client-side
--    via best-effort IP geolocation on first login after this ships. Nullable —
--    users who predate this or whose geolocation lookup failed just don't show
--    up in the region tab until it's set, same fallback pattern as everything
--    else optional on this table.
--
-- 2. Re-creates weekly_leaderboard to also select region, so the client can
--    filter the same view by `region = <mine>` instead of standing up a
--    second view.
--
-- 3. Re-applies (idempotent: drop-if-exists + create) the user_progress and
--    sign_attempts public-select policies from 20260709000000 and
--    20260709010000. Those migrations already fixed "world leaderboard shows
--    0 XP for everyone but you" in the repo, but a report of the identical
--    symptom (own XP correct, a friend's showing 0) after those files had
--    already landed means they were never actually run against production —
--    migration files sitting in the repo don't apply themselves. Re-running
--    the idempotent DROP/CREATE here is a no-op if they're already live and
--    the actual fix if they aren't, without needing to know which case this
--    database is in.
-- ============================================================

drop policy if exists "progress_all_own" on public.user_progress;

create policy "progress_select_public" on public.user_progress
  for select using (true);

create policy "progress_insert_own" on public.user_progress
  for insert with check (auth.uid() = user_id);

create policy "progress_update_own" on public.user_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "progress_delete_own" on public.user_progress
  for delete using (auth.uid() = user_id);


drop policy if exists "attempts_own" on public.sign_attempts;

create policy "attempts_select_public" on public.sign_attempts
  for select using (true);

create policy "attempts_insert_own" on public.sign_attempts
  for insert with check (auth.uid() = user_id and not public.current_user_banned());

create policy "attempts_update_own" on public.sign_attempts
  for update using (auth.uid() = user_id and not public.current_user_banned())
  with check (auth.uid() = user_id and not public.current_user_banned());

create policy "attempts_delete_own" on public.sign_attempts
  for delete using (auth.uid() = user_id and not public.current_user_banned());


alter table public.profiles
  add column if not exists region text;

-- CREATE OR REPLACE VIEW cannot reorder/rename existing columns (region is inserted
-- mid-list, before the pre-existing signs_this_week) — drop and recreate instead.
drop view if exists public.weekly_leaderboard;

create view public.weekly_leaderboard
  with (security_invoker = true)
as
select
  p.id,
  p.username,
  p.region                     as region,
  coalesce(
    count(sa.id) filter (
      where sa.passed
        and sa.attempted_at >= date_trunc('week', now())
    ), 0
  )::int                        as signs_this_week,
  coalesce(up.xp, 0)           as total_xp,
  coalesce(up.streak, 0)       as streak,
  up.equipped_avatar           as equipped_avatar,
  up.equipped_border           as equipped_border,
  up.active_badge              as active_badge
from public.profiles p
left join public.user_progress up on up.user_id = p.id
left join public.sign_attempts sa on sa.user_id = p.id
group by p.id, p.username, p.region, up.xp, up.streak, up.equipped_avatar, up.equipped_border, up.active_badge
order by signs_this_week desc, total_xp desc;

grant select on public.weekly_leaderboard to anon, authenticated;
