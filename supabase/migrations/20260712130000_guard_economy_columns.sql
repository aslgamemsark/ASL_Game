-- ============================================================
-- Close the client-authoritative-economy gap for cosmetics/worlds/badges/chests.
--
-- FINDING (production audit, 2026-07-12): guard_progress_deltas (20260710120000) only
-- clamps gold/xp/signs/total_correct_signs. owned_cosmetics, equipped_border,
-- equipped_avatar, unlocked_world_ids, badges, pending_chests, rename_cards,
-- streak_freezes, and streak_milestones_awarded are upserted straight from the client
-- with zero server-side validation of the value — a single authenticated REST call
-- (`update user_progress set owned_cosmetics = '{everything}', unlocked_world_ids =
-- '{all_worlds}', badges = '{every_badge}'`) currently grants every paid/earned item
-- instantly. The admin_grant_cosmetics / admin_set_cosmetic / admin_set_world_flag RPCs
-- exist specifically to gate this — this bug makes that gate decorative.
--
-- DESIGN CHOICE: same "clamp the delta, don't reject the write" philosophy as
-- guard_progress_deltas, extended to array columns. A hard rejection risks permanently
-- breaking sync (see that migration's rationale) — a user who legitimately earns several
-- badges in one lesson-complete tick, or buys 2 worlds before the next debounced sync,
-- must not have their whole write bounce. Instead: cap how many NEW elements an array
-- column may gain in a single write to a generous ceiling, and silently truncate any
-- excess (keeping the array's own ordering) rather than rejecting the update. This turns
-- "grant myself literally everything in one call" into "at most N items per write,
-- indefinitely repeatable at the client's normal sync cadence" — same blast-radius
-- reduction as the numeric ceilings, not a full fix (see that migration's note that the
-- real fix is moving every earning action behind a SECURITY DEFINER RPC, deferred as
-- disproportionate for this beta stage).
--
-- BONUS FIX while touching this: equipped_border/equipped_avatar/active_badge are also
-- currently settable to any string with no check that the item is actually owned —
-- e.g. `equipped_border = 'legendary_border'` displays it without ever unlocking it.
-- Now enforced: an equip value must be null or present in the (post-clamp) owned array.
--
-- EXEMPTION: admins remain fully exempt, matching guard_progress_deltas.
-- ============================================================

create or replace function public.guard_progress_deltas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_is_admin  boolean;
  gold_ceiling      constant int := 20000;
  xp_ceiling        constant int := 10000;
  signs_ceiling     constant int := 2000;
  correct_ceiling   constant int := 2000;
  cosmetics_ceiling constant int := 5;
  worlds_ceiling    constant int := 3;
  badges_ceiling    constant int := 8;
  chests_ceiling    constant int := 5;
  rename_ceiling    constant int := 20;
  freeze_ceiling    constant int := 10;
  milestone_ceiling constant int := 10;
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
  if new.rename_cards - old.rename_cards > rename_ceiling then
    new.rename_cards := old.rename_cards + rename_ceiling;
  end if;
  if new.streak_freezes - old.streak_freezes > freeze_ceiling then
    new.streak_freezes := old.streak_freezes + freeze_ceiling;
  end if;

  -- owned_cosmetics: cap how many genuinely-new ids land in one write, preserving order.
  -- The inner subquery's LIMIT must run BEFORE array_agg collapses everything to one row —
  -- a LIMIT after an aggregate with no GROUP BY is a no-op, since there's only ever 1 row.
  if coalesce(array_length(new.owned_cosmetics, 1), 0) - coalesce(array_length(old.owned_cosmetics, 1), 0) > cosmetics_ceiling then
    new.owned_cosmetics := coalesce(old.owned_cosmetics, '{}') || (
      select coalesce(array_agg(x order by ord), '{}')
      from (
        select x, ord from unnest(new.owned_cosmetics) with ordinality as t(x, ord)
        where not (x = any(coalesce(old.owned_cosmetics, '{}')))
        order by ord
        limit cosmetics_ceiling
      ) capped
    );
  end if;

  if coalesce(array_length(new.unlocked_world_ids, 1), 0) - coalesce(array_length(old.unlocked_world_ids, 1), 0) > worlds_ceiling then
    new.unlocked_world_ids := coalesce(old.unlocked_world_ids, '{}') || (
      select coalesce(array_agg(x order by ord), '{}')
      from (
        select x, ord from unnest(new.unlocked_world_ids) with ordinality as t(x, ord)
        where not (x = any(coalesce(old.unlocked_world_ids, '{}')))
        order by ord
        limit worlds_ceiling
      ) capped
    );
  end if;

  if coalesce(array_length(new.badges, 1), 0) - coalesce(array_length(old.badges, 1), 0) > badges_ceiling then
    new.badges := coalesce(old.badges, '{}') || (
      select coalesce(array_agg(x order by ord), '{}')
      from (
        select x, ord from unnest(new.badges) with ordinality as t(x, ord)
        where not (x = any(coalesce(old.badges, '{}')))
        order by ord
        limit badges_ceiling
      ) capped
    );
  end if;

  if coalesce(array_length(new.streak_milestones_awarded, 1), 0) - coalesce(array_length(old.streak_milestones_awarded, 1), 0) > milestone_ceiling then
    new.streak_milestones_awarded := coalesce(old.streak_milestones_awarded, '{}') || (
      select coalesce(array_agg(x order by ord), '{}')
      from (
        select x, ord from unnest(new.streak_milestones_awarded) with ordinality as t(x, ord)
        where not (x = any(coalesce(old.streak_milestones_awarded, '{}')))
        order by ord
        limit milestone_ceiling
      ) capped
    );
  end if;

  -- pending_chests: jsonb array, capped by element count the same way (dedupe on the chest's own id).
  if jsonb_array_length(coalesce(new.pending_chests, '[]')) - jsonb_array_length(coalesce(old.pending_chests, '[]')) > chests_ceiling then
    new.pending_chests := coalesce(old.pending_chests, '[]') || (
      select coalesce(jsonb_agg(elem order by ord), '[]')
      from (
        select elem, ord from jsonb_array_elements(new.pending_chests) with ordinality as t(elem, ord)
        where not exists (
          select 1 from jsonb_array_elements(coalesce(old.pending_chests, '[]')) o
          where o->>'id' = elem->>'id'
        )
        order by ord
        limit chests_ceiling
      ) capped
    );
  end if;

  -- Equip fields must reference an item actually owned (post-clamp) — closes the
  -- "equip an item you were never granted" display bypass.
  if new.equipped_border is not null and not (new.equipped_border = any(new.owned_cosmetics)) then
    new.equipped_border := old.equipped_border;
  end if;
  if new.equipped_avatar is not null and not (new.equipped_avatar = any(new.owned_cosmetics)) then
    new.equipped_avatar := old.equipped_avatar;
  end if;
  if new.active_badge is not null and not (new.active_badge = any(new.badges)) then
    new.active_badge := old.active_badge;
  end if;

  return new;
end;
$$;
