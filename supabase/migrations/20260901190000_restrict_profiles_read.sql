-- ============================================================
-- F-003 (LOW), PART 2 of 2 — TIGHTENING. APPLY AFTER CLIENTS HAVE ROLLED OVER.
--
-- Split out of 20260901180000 on purpose. AGENTS.md requires migrations to be additive-only so a
-- browser tab running a stale JS bundle keeps working across a deploy. This migration is the one
-- exception that cannot be additive -- restricting a read path IS the fix -- so it is isolated
-- here and sequenced last.
--
-- ORDER OF OPERATIONS (all three steps, in this order):
--   1. Apply 20260901180000  -- adds public_profiles; breaks nothing
--   2. Deploy the client      -- it now reads public_profiles for cross-user lookups
--   3. Apply THIS migration   -- only now is the old cross-user read path removed
--
-- Applying this BEFORE step 2 degrades any client still on the old bundle: friends search,
-- leaderboard usernames and the username-uniqueness check would silently return zero rows.
-- Nothing crashes, but names disappear, so do not skip ahead.
--
-- Runtime-verified after this migration (SECURITY_AUDIT/harness/verify-phase2.mjs):
--   anon CANNOT read the profiles base table ......................... rows=0
--   authenticated CANNOT read another user's privilege/moderation cols  rows=0
--   user CAN still read their OWN flags (AuthContext depends on it) ... PASS
--   admin CAN still read all profiles (moderation panel) ............. n=4
-- ============================================================

--
-- `profiles_select_public` was `using (true)`, and with Supabase's default grants that made the
-- WHOLE row readable by anon -- verified at runtime: anon read 4/4 profile rows including
-- is_admin, is_banned and ban_reason. ban_reason holds free-text moderator notes about a user,
-- and is_admin tells an attacker precisely which two accounts to target.
--
-- Postgres RLS is row-level, not column-level, so the fix is a curated projection: a
-- public_profiles view carrying only the fields other users legitimately need, with the base
-- table restricted to own-row (plus admins, who need to moderate).
--
-- Verified against every caller before changing it -- every cross-user read in web/src/ requests
-- only `id, username`:
--   FriendsPage.tsx:105,159 · LeaderboardPage.tsx:350 · AdminPanel.tsx:440,837 · lib/username.ts:14
-- Self-reads that need the sensitive columns (AuthContext's username/is_admin/is_banned/
-- ban_reason, useProgressSync's collect_training_data/region) all filter on the caller's own id
-- and therefore still pass the own-row policy unchanged.


-- The admin carve-out MUST go through a SECURITY DEFINER helper, not an inline subquery. A
-- policy ON profiles that itself selects FROM profiles re-enters the same policy and Postgres
-- aborts with "infinite recursion detected in policy for relation profiles" -- caught by running
-- this migration against a real database rather than by reading it. current_user_banned() already
-- establishes exactly this pattern (SECURITY DEFINER + pinned search_path); this is its sibling.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to anon, authenticated;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using ((select auth.uid()) = id or public.current_user_is_admin());
