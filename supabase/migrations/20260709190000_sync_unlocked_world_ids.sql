-- unlockedWorldIds (gold-purchased world unlocks, see useUserStore.unlockWorldWithGold) has
-- lived ONLY in the client Zustand store since it was added — same class of bug the
-- 20260707120000_admin_panel.sql migration already fixed once for gold/cosmetics ("Previously
-- gold/cosmetics lived ONLY in the client Zustand store"). Without a synced column, a world
-- bought with gold vanishes the moment progress is reloaded from Supabase on another device or
-- session (mergeProgress has nothing remote to merge it with), even though the purchase itself
-- succeeded and the gold was already spent.

alter table public.user_progress add column if not exists unlocked_world_ids text[] default '{}' not null;
