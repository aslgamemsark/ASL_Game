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
