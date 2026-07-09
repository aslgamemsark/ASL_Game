-- ============================================================
-- Progress delta guard — pragmatic stopgap against the client-authoritative economy.
--
-- FINDING: gold/xp/signs/total_correct_signs are written straight from the client Zustand store
-- via a raw upsert (see web/src/hooks/useProgressSync.ts) with no server-side validation of the
-- value itself — only the existing absolute-bound CHECK constraint (user_progress_sane). A user
-- could open devtools and call `supabase.from('user_progress').upsert({gold: 100000000})` in one
-- shot. The full fix (every gold/xp-earning action moved server-side behind SECURITY DEFINER
-- RPCs, the same pattern already proven in 20260707120000_admin_panel.sql) is a large rewrite,
-- disproportionate to a closed/friends beta. This is a stopgap that meaningfully raises the bar
-- without it.
--
-- DESIGN CHOICE: CLAMP the delta, don't REJECT the update. A hard rejection risks permanently
-- breaking sync for a legitimate case — a user who plays offline for a while and syncs once with
-- a large accumulated delta. Rejecting that write would leave useProgressSync's retry loop
-- failing forever and the user's real progress never landing in Supabase. Clamping instead means
-- a single write can never instantly grant more than the ceiling, while a legitimate large sync
-- still succeeds (just capped for that one write; the rest reconciles on the next natural sync
-- once more local progress accrues) — same spirit as the existing sanity-bound constraint, just
-- delta-based instead of absolute-based.
--
-- EXEMPTION: admins are exempt entirely — both the admin_grant_gold-style RPCs (which are already
-- server-gated + audit-logged, see admin_audit_log) and the owner-only "Add 10,000 Gold & Signs
-- (local test)" dev button in Settings (which upserts through this same normal sync path) need to
-- be able to move the needle by more than these ceilings in one write.
-- ============================================================

create or replace function public.guard_progress_deltas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin boolean;
  gold_ceiling    constant int := 20000;
  xp_ceiling      constant int := 10000;
  signs_ceiling   constant int := 2000;
  correct_ceiling constant int := 2000;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if coalesce(caller_is_admin, false) then
    return new;
  end if;

  if new.gold - old.gold > gold_ceiling then
    new.gold := old.gold + gold_ceiling;
  end if;
  if new.xp - old.xp > xp_ceiling then
    new.xp := old.xp + xp_ceiling;
  end if;
  if new.signs - old.signs > signs_ceiling then
    new.signs := old.signs + signs_ceiling;
  end if;
  if new.total_correct_signs - old.total_correct_signs > correct_ceiling then
    new.total_correct_signs := old.total_correct_signs + correct_ceiling;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_progress_deltas_trg on public.user_progress;
create trigger guard_progress_deltas_trg
  before update on public.user_progress
  for each row execute function public.guard_progress_deltas();
