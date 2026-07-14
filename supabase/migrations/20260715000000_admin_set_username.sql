-- ============================================================
-- Admin username rename — 2026-07-15
-- Adds the one missing admin lever: renaming another user. Banning alone does NOT remove an
-- offensive username from leaderboards/friend lists (profiles stay publicly readable by design —
-- see admin_panel.sql §5), and RLS's profiles_update_own only lets a user edit their OWN row, so
-- an admin previously had no in-app way to clear a slur that was grandfathered in before the
-- username profanity filter existed. This RPC is the same SECURITY DEFINER + is_admin-check +
-- audit-log pattern as every other admin_* function. Idempotent: safe to re-run.
-- ============================================================

create or replace function public.admin_set_username(
  target_user_id uuid, new_name text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
  old_name text;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Format is enforced by the existing profiles_username_format CHECK (^[a-zA-Z0-9_]{3,20}$); do a
  -- friendly pre-check so the admin gets a clear message instead of a raw constraint violation.
  if new_name !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'username must be 3-20 chars, letters/numbers/underscore only';
  end if;

  -- Uniqueness is enforced by the unique constraint too; pre-check for a clear message.
  if exists (select 1 from public.profiles where username = new_name and id <> target_user_id) then
    raise exception 'username already taken';
  end if;

  select username into old_name from public.profiles where id = target_user_id;
  if old_name is null then
    raise exception 'target user not found';
  end if;

  update public.profiles set username = new_name where id = target_user_id;

  insert into public.admin_audit_log (admin_id, action, target_user_id, payload)
    values (
      auth.uid(), 'set_username', target_user_id,
      jsonb_build_object('old', old_name, 'new', new_name)
    );
end;
$$;

grant execute on function public.admin_set_username(uuid, text) to authenticated;
