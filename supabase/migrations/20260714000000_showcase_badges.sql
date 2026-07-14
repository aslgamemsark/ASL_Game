-- ============================================================
-- Sync showcase_badges (the up-to-3 pinned badges a player chooses to display) to the server.
--
-- Previously this lived only in the client-side Zustand store (useUserStore.showcaseBadges),
-- never synced to Supabase — so it couldn't be read for anyone but the currently-signed-in user,
-- meaning another player's public profile could never show it. `active_badge` (the single badge
-- used as a profile-picture fallback) was already synced; this closes the same gap for the
-- 3-badge showcase strip.
-- ============================================================

alter table public.user_progress
  add column if not exists showcase_badges text[] not null default '{}'::text[];

-- CREATE OR REPLACE VIEW cannot add a column in the middle of the existing list without also
-- being fine with it landing at the end — adding showcase_badges last is fine here (matches how
-- `region` was appended in 20260712120000), so this one doesn't strictly need drop+create, but
-- kept consistent with the established pattern in this file for anyone diffing history.
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
  up.active_badge              as active_badge,
  coalesce(up.showcase_badges, '{}'::text[]) as showcase_badges
from public.profiles p
left join public.user_progress up on up.user_id = p.id
left join public.sign_attempts sa on sa.user_id = p.id
group by p.id, p.username, p.region, up.xp, up.streak, up.equipped_avatar, up.equipped_border, up.active_badge, up.showcase_badges
order by signs_this_week desc, total_xp desc;

grant select on public.weekly_leaderboard to anon, authenticated;
