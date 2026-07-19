-- Performance-advisor fixes (applied to production 2026-07-19).
--
-- 1. Covering indexes for foreign keys the advisor flagged (0001). Without these, cascade
--    deletes and joins on the FK column do a sequential scan. Cheap and behavior-preserving.
create index if not exists friendships_addressee_id_idx        on public.friendships(addressee_id);
create index if not exists multiplayer_room_members_user_id_idx on public.multiplayer_room_members(user_id);
create index if not exists multiplayer_rooms_host_id_idx        on public.multiplayer_rooms(host_id);
create index if not exists admin_audit_log_admin_id_idx         on public.admin_audit_log(admin_id);
create index if not exists admin_audit_log_target_user_id_idx   on public.admin_audit_log(target_user_id);
create index if not exists feedback_user_id_idx                 on public.feedback(user_id);
create index if not exists sign_verification_log_user_id_idx    on public.sign_verification_log(user_id);
create index if not exists world_flags_updated_by_idx           on public.world_flags(updated_by);

-- 2. auth_rls_initplan (0003) for the policy introduced earlier today: wrap auth.uid() in a scalar
--    subquery so Postgres evaluates it once per query instead of once per row. Verified the
--    membership read still resolves under the authenticated role after the rewrite.
--    The ~27 pre-existing policies with the same pattern are a documented post-launch batch — a
--    mass rewrite of security policies right before launch is not worth the logic-regression risk
--    for a gain that doesn't materialize below thousands of concurrent users.
drop policy if exists "members_select_own" on public.multiplayer_room_members;
create policy "members_select_own" on public.multiplayer_room_members
  for select using (user_id = (select auth.uid()));

-- Left as-is (reviewed): the 3 "unused index" INFO hits (user_reports_reported_idx,
-- sign_verification_log_sign_idx, feedback_status_idx) back admin/moderation queries that simply
-- haven't run much yet at 12 users — they are not dead, so they stay.
