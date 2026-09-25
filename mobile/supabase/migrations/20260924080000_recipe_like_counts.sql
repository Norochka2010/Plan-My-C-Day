-- Reuse existing unique helpful reactions as recipe likes; expose aggregate only.
begin;
create or replace function public.community_recipe_json(r public.community_recipes) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'effort_level',r.effort_level,
 'ingredients',r.ingredients,'steps',r.steps,'double_check_tags',r.double_check_tags,'use_case_tags',r.use_case_tags,'friend_tip',r.friend_tip,
 'status',r.status,'revision',r.revision,'submitted_at',r.submitted_at,'published_at',r.published_at,
 'author_username',(select p.username from public.account_profiles p where p.user_id=r.author_user_id and p.username_public),
 'is_author',r.author_user_id=auth.uid(),
 'saved',exists(select 1 from public.community_recipe_saves where recipe_id=r.id and user_id=auth.uid()),
 'like_count',(select count(*) from public.community_recipe_reactions where recipe_id=r.id),
 'helpful',exists(select 1 from public.community_recipe_reactions where recipe_id=r.id and user_id=auth.uid()))
$$;


commit;
