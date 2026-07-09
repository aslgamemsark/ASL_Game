-- Same bug class as 20260709190000 (unlocked_world_ids) and the gold/cosmetics fix before it:
-- these fields only ever lived in the client Zustand store, never in Supabase, so they were
-- silently lost/reset the moment progress reloaded on another device or session — even though
-- some of them represent already-spent currency (renameCards) or already-earned rewards
-- (badges, pendingChests). streak_milestones_awarded is the worst of these: streak itself DOES
-- sync, but the "already awarded" list doesn't, so the same 7/30/100-day gold bonus could be
-- re-granted on a device that never recorded it.

alter table public.user_progress add column if not exists signs                    integer default 0    not null;
alter table public.user_progress add column if not exists rename_cards             integer default 0    not null;
alter table public.user_progress add column if not exists badges                   text[]  default '{}' not null;
alter table public.user_progress add column if not exists pending_chests           jsonb   default '[]' not null;
alter table public.user_progress add column if not exists total_correct_signs      integer default 0    not null;
alter table public.user_progress add column if not exists streak_freezes           integer default 1    not null;
alter table public.user_progress add column if not exists streak_milestones_awarded integer[] default '{}' not null;
alter table public.user_progress add column if not exists speed_high_scores        jsonb   default '{}' not null;

-- Extend the existing sanity-bound constraint (see admin_panel migration) to cover the new
-- currency-like fields the same way it already covers gold. Original bounds preserved exactly;
-- only the new fields' bounds are added.
alter table public.user_progress drop constraint if exists user_progress_sane;
alter table public.user_progress add constraint user_progress_sane check (
  xp >= 0 and xp <= 100000000
  and level >= 1 and level <= 1000
  and streak >= 0 and streak <= 100000
  and longest_streak >= 0 and longest_streak <= 100000
  and gold >= 0 and gold <= 100000000
  and signs >= 0 and signs <= 100000000
  and rename_cards >= 0 and rename_cards <= 10000
  and total_correct_signs >= 0 and total_correct_signs <= 100000000
  and streak_freezes >= 0 and streak_freezes <= 10000
);
