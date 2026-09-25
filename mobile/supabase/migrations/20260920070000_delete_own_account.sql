begin;
create or replace function public.delete_own_account(p_expected_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or u is distinct from p_expected_user then
    raise exception 'Please sign in again before deleting your account.';
  end if;
  delete from public.community_recipe_saves where user_id=u or recipe_id in (select id from public.community_recipes where author_user_id=u);
  delete from public.community_recipe_reactions where user_id=u or recipe_id in (select id from public.community_recipes where author_user_id=u);
  delete from public.community_recipe_hides where user_id=u or recipe_id in (select id from public.community_recipes where author_user_id=u);
  delete from public.community_reports where reporter_user_id=u or recipe_id in (select id from public.community_recipes where author_user_id=u);
  delete from public.community_moderation_actions where moderator_user_id=u or recipe_id in (select id from public.community_recipes where author_user_id=u);
  delete from public.community_recipes where author_user_id=u;
  delete from public.community_member_reputation where user_id=u;
  update public.community_moderators set assigned_by=null where assigned_by=u;
  delete from public.community_moderators where user_id=u;
  -- Profile, plans, reflections and learning progress use cascading owner keys.
  delete from auth.users where id=u;
  if not found then raise exception 'Account no longer exists.'; end if;
end;
$$;
revoke all on function public.delete_own_account(uuid) from public, anon;
grant execute on function public.delete_own_account(uuid) to authenticated;
commit;
