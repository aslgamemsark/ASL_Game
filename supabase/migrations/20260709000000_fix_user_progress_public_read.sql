-- ============================================================
-- Fix: leaderboard and friends board showed 0 XP for everyone except
-- yourself, and other players' equipped avatar/border never showed on
-- the leaderboard either.
--
-- Root cause: "progress_all_own" was `for all using (auth.uid() = user_id)`,
-- which blocks SELECT of any row that isn't your own. weekly_leaderboard is
-- `security_invoker = true` (runs as the querying user), so its join to
-- user_progress silently returned null (-> coalesce'd to 0) for every row
-- but the caller's own. The same table is also queried directly from the
-- client for the Leaderboard "Friends" tab and the Friends page, hitting
-- the identical wall.
--
-- Fix: split the single "for all" policy into a public SELECT policy (xp,
-- streak, cosmetics, etc. are meant to be seen by other players — a
-- leaderboard/friends feature can't work otherwise) and keep INSERT/UPDATE/
-- DELETE restricted to the row's own owner. This mirrors the existing
-- "profiles_select_public" policy, which already made username public for
-- the exact same reason.
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
