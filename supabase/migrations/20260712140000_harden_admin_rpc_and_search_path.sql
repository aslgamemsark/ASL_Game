-- ============================================================
-- Two small hardening items surfaced by Supabase's own security advisor
-- (get_advisors) during the 2026-07-12 production audit.
--
-- 1. current_user_banned() had a mutable search_path (no `set search_path`), the
--    classic function-hijacking vector: a caller who can create objects in a schema
--    earlier in their session's search_path could shadow an unqualified identifier
--    the function relies on. The function's one query already schema-qualifies
--    `public.profiles`, so this was low-risk in practice, but every other
--    SECURITY DEFINER/STABLE function in this codebase already sets search_path —
--    this one was just missed. Pin it the same way.
--
-- 2. admin_grant_gold / admin_set_cosmetic / admin_grant_cosmetics / admin_set_ban /
--    admin_get_user_progress / admin_set_world_flag are SECURITY DEFINER and each
--    already re-checks is_admin internally before doing anything privileged (see
--    20260707120000_admin_panel.sql and 20260709010000_security_hardening.sql) — a
--    non-admin call always fails safely. But Postgres grants EXECUTE to the PUBLIC
--    pseudo-role by default on function creation, which anon inherits — meaning an
--    unauthenticated request can currently reach these RPCs at all (and get charged
--    the round-trip + a logged permission-denied audit row) with zero legitimate
--    reason to. Revoking from PUBLIC and re-granting only to `authenticated` closes
--    that unnecessary surface without changing behavior for real admins, who are
--    always authenticated. NOTE: revoking from `anon` alone is not sufficient —
--    anon still inherits execute via the PUBLIC grant unless PUBLIC itself is
--    revoked; re-granting to `authenticated` explicitly is what keeps real admin
--    calls working.
-- ============================================================

create or replace function public.current_user_banned()
returns boolean language sql stable set search_path = public as $$
  select coalesce((select is_banned from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.admin_grant_gold(uuid, int, text) from public;
revoke execute on function public.admin_set_cosmetic(uuid, text, text) from public;
revoke execute on function public.admin_grant_cosmetics(uuid, text[]) from public;
revoke execute on function public.admin_set_ban(uuid, boolean, text) from public;
revoke execute on function public.admin_get_user_progress(uuid) from public;
revoke execute on function public.admin_set_world_flag(text, boolean, boolean) from public;

grant execute on function public.admin_grant_gold(uuid, int, text) to authenticated;
grant execute on function public.admin_set_cosmetic(uuid, text, text) to authenticated;
grant execute on function public.admin_grant_cosmetics(uuid, text[]) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;
grant execute on function public.admin_get_user_progress(uuid) to authenticated;
grant execute on function public.admin_set_world_flag(text, boolean, boolean) to authenticated;

-- guard_progress_deltas/handle_new_user/protect_privileged_profile_columns are TRIGGER
-- functions — nothing should ever call them directly via /rpc/, only via the trigger mechanism
-- itself (INSERT/UPDATE on the table they're attached to), which does NOT require the
-- triggering role to hold EXECUTE on the function — that's a well-established, version-
-- independent piece of Postgres trigger semantics, not something this revoke can break. Unlike
-- the admin RPCs above, `revoke ... from public` alone did not clear anon's access for these
-- three — Supabase's schema-level default privileges grant EXECUTE directly to anon/authenticated
-- on new functions (not only via the PUBLIC pseudo-role), so both must be revoked explicitly.
revoke execute on function public.guard_progress_deltas() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.protect_privileged_profile_columns() from anon, authenticated;
