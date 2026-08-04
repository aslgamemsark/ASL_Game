-- CRITICAL multiplayer fix + security-advisor hardening (applied to production 2026-07-19).
--
-- multiplayer_room_members had RLS enabled but NO policy. The Realtime Authorization policies on
-- realtime.messages (room_receive_members / room_send_members) check membership by selecting from
-- this table AS the authenticated user — with no SELECT policy that read is denied, exists() is
-- false, and EVERY private room subscribe fails ("stuck on joining room"). The bug was invisible
-- to superuser SQL tests because RLS is bypassed for the table owner; it only reproduces when the
-- check runs as the authenticated role, which is exactly how Realtime evaluates it. A user only
-- needs to see their OWN membership row for the check, so SELECT is scoped to self (also keeps the
-- roster private — a member can't enumerate the table).
create policy "members_select_own" on public.multiplayer_room_members
  for select using (user_id = auth.uid());

-- Same gap as multiplayer_rooms (see that migration's later grant comment, added same day this
-- was found): a policy alone doesn't let `authenticated` attempt the SELECT at all without the
-- base table-level GRANT. No insert/update/delete: every write to this table goes through
-- add_host_to_room_members() (SECURITY DEFINER trigger, bypasses grants), never a direct client
-- write, which is exactly why the table's original comment says "Deliberately NO client-facing
-- policies" and stays true for writes even after this file adds one read policy.
grant select on public.multiplayer_room_members to authenticated, service_role;

-- Advisor 0028/0029: two SECURITY DEFINER functions were REST-callable by anon/authenticated but
-- must not be. add_host_to_room_members() is a trigger function; trim_training_samples() is the
-- pg_cron maintenance job. Both fire as their owner regardless of grants, so revoking public
-- EXECUTE closes the RPC surface at zero functional cost.
revoke execute on function public.add_host_to_room_members() from anon, authenticated, public;
revoke execute on function public.trim_training_samples() from anon, authenticated, public;

-- Left intentionally as-is (reviewed, not defects):
--   * room_join_attempts RLS-no-policy: touched only by the SECURITY DEFINER join RPC (owner,
--     bypasses RLS) and never by a policy that runs as the user — deny-all to clients is correct.
--   * admin_* functions executable by authenticated: each re-checks is_admin internally (verified),
--     the correct pattern given there is no dedicated admin DB role.
--   * join_multiplayer_room / leave_multiplayer_room executable by authenticated: intended.
