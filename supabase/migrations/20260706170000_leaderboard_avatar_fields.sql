-- ============================================================
-- Adds equipped cosmetics + active badge to user_progress so the
-- leaderboard can render each player's real avatar/border, not a
-- generic rank-tier icon. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table public.user_progress
  add column if not exists equipped_avatar text,
  add column if not exists equipped_border text,
  add column if not exists active_badge    text;

-- Re-create the weekly leaderboard view to expose the new columns.
create or replace view public.weekly_leaderboard
  with (security_invoker = true)
as
select
  p.id,
  p.username,
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
group by p.id, p.username, up.xp, up.streak, up.equipped_avatar, up.equipped_border, up.active_badge
order by signs_this_week desc, total_xp desc;

grant select on public.weekly_leaderboard to anon, authenticated;
