-- Harden admin_set_username — 2026-07-15
-- admin_set_username was added (20260715000000_admin_set_username.sql) after the
-- 20260712140000_harden_admin_rpc_and_search_path.sql pass that revoked stray PUBLIC/anon EXECUTE
-- grants from every other admin_* function, so it never got the same lockdown. The is_admin check
-- inside the function still blocks non-admins either way, but this closes the same unnecessary
-- anon-reachable attack surface the earlier hardening migration was written to close for the rest
-- of the admin RPC surface. Idempotent: safe to re-run.
revoke execute on function public.admin_set_username(uuid, text) from public;
revoke execute on function public.admin_set_username(uuid, text) from anon;
grant execute on function public.admin_set_username(uuid, text) to authenticated;
