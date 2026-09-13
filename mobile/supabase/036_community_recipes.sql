-- Community V1. Run in Supabase SQL Editor as the database owner.
-- No changes to users, Explore, Plan, storage or authentication.
begin;
create table if not exists public.community_moderators (
 user_id uuid primary key references auth.users(id), assigned_at timestamptz not null default now(),
 assigned_by uuid references auth.users(id), active boolean not null default true
);
create table if not exists public.community_member_reputation (
 user_id uuid primary key references auth.users(id), tier text not null default 'new'
 check(tier in ('new','member','trusted_contributor','community_contributor','moderator')),
 approved_contribution_count integer not null default 0, upheld_report_count integer not null default 0,
 last_reviewed_at timestamptz, manually_assigned boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.community_recipes (
 id uuid primary key, author_user_id uuid not null references auth.users(id),
 title text not null default '' check(length(title)<=100), category text not null default '', effort_level text not null default '',
 -- Ordered JSON arrays keep the small structured draft atomic, including incomplete rows.
 ingredients jsonb not null default '[]', steps jsonb not null default '[]', double_check_tags jsonb not null default '[]', use_case_tags jsonb not null default '[]',
 friend_tip text not null default '' check(length(friend_tip)<=600), photo_url text,
 status text not null default 'draft' check(status in ('draft','pending_review','published','flagged','hidden','removed')),
 review_required boolean not null default false, prescreen_status text not null default 'not_connected', prescreen_flags jsonb not null default '[]',
 acknowledgement_version text, acknowledgements jsonb, submitted_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 1
);
create table if not exists public.community_recipe_saves (
 recipe_id uuid references public.community_recipes(id), user_id uuid references auth.users(id), created_at timestamptz not null default now(), primary key(recipe_id,user_id)
);
create table if not exists public.community_recipe_reactions (
 recipe_id uuid references public.community_recipes(id), user_id uuid references auth.users(id), reaction_type text not null default 'helpful' check(reaction_type='helpful'), created_at timestamptz not null default now(), primary key(recipe_id,user_id,reaction_type)
);
create table if not exists public.community_recipe_hides (
 recipe_id uuid references public.community_recipes(id), user_id uuid references auth.users(id), created_at timestamptz not null default now(), primary key(recipe_id,user_id)
);
create table if not exists public.community_reports (
 id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.community_recipes(id), reporter_user_id uuid not null references auth.users(id),
 reason_code text not null check(reason_code in ('Food-safety concern','Medical misinformation','Personal information','Bullying or harassment','Inappropriate content','Spam or advertising','Other')),
 optional_note text not null default '' check(length(optional_note)<=500), status text not null default 'open' check(status in ('open','reviewing','resolved')),
 created_at timestamptz not null default now(), resolved_at timestamptz, unique(recipe_id,reporter_user_id)
);
create table if not exists public.community_moderation_actions (
 id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.community_recipes(id),
 action text not null check(action in ('approve','flag','hide','remove','restore','resolve_reports')),
 moderator_user_id uuid not null references auth.users(id), reason_code text not null, note text not null default '', created_at timestamptz not null default now()
);
create index if not exists community_recipe_status_idx on public.community_recipes(status,submitted_at);
create index if not exists community_recipe_author_idx on public.community_recipes(author_user_id,updated_at);
-- No direct client table access. Security-definer RPCs enforce ownership, state transitions,
-- and explicit field projections; RLS is an additional deny-by-default boundary.
do $$ declare t text; begin
 foreach t in array array['community_moderators','community_member_reputation','community_recipes','community_recipe_saves','community_recipe_reactions','community_recipe_hides','community_reports','community_moderation_actions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from public,anon,authenticated',t);
 end loop;
end $$;
create or replace function public.community_is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.community_moderators where user_id=auth.uid() and active)
$$;
-- Projection never includes author identity, reporter identity, or private reputation.
create or replace function public.community_recipe_json(r public.community_recipes) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'effort_level',r.effort_level,
 'ingredients',r.ingredients,'steps',r.steps,'double_check_tags',r.double_check_tags,'use_case_tags',r.use_case_tags,'friend_tip',r.friend_tip,
 'status',r.status,'revision',r.revision,'submitted_at',r.submitted_at,'published_at',r.published_at,
 'is_author',r.author_user_id=auth.uid(),
 'saved',exists(select 1 from public.community_recipe_saves where recipe_id=r.id and user_id=auth.uid()),
 'helpful',exists(select 1 from public.community_recipe_reactions where recipe_id=r.id and user_id=auth.uid()))
$$;
create or replace function public.community_read(p_mode text default 'browse',p_id uuid default null,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); m boolean:=public.community_is_moderator(); result jsonb; r public.community_recipes;
begin
 if u is null then raise exception 'Sign in to use Community.'; end if;
 if p_mode='role' then return jsonb_build_object('moderator',m); end if;
 if p_mode='detail' then
 select * into r from public.community_recipes where id=p_id;
 if not found or not (r.author_user_id=u or m or (r.status='published' and not exists(select 1 from public.community_recipe_hides where recipe_id=p_id and user_id=u))) then raise exception 'This recipe is not available.'; end if;
 result:=public.community_recipe_json(r);
 if m then result:=result||jsonb_build_object('review_required',r.review_required,'prescreen_status',r.prescreen_status,'prescreen_flags',r.prescreen_flags,'acknowledgements',r.acknowledgements,'acknowledgement_version',r.acknowledgement_version,
 'reports',coalesce((select jsonb_agg(jsonb_build_object('reason',reason_code,'note',optional_note,'status',status,'created_at',created_at) order by created_at) from public.community_reports where recipe_id=p_id),'[]'),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason_code,'note',note,'created_at',created_at) order by created_at) from public.community_moderation_actions where recipe_id=p_id),'[]')); end if;
 return result;
 end if;
 if p_mode not in ('browse','mine','saved','queue') or (p_mode='queue' and not m) then raise exception 'Not authorized.'; end if;
 select coalesce(jsonb_agg(item order by ordering),'[]') into result from (
 select public.community_recipe_json(c) || case when p_mode='queue' then jsonb_build_object('review_required',c.review_required,'prescreen_status',c.prescreen_status) else '{}'::jsonb end as item,
 row_number() over(order by case when p_mode='queue' then coalesce(c.submitted_at,c.created_at) end asc,c.updated_at desc,c.id) ordering
 from public.community_recipes c where
 (p_mode='mine' and c.author_user_id=u) or
 (p_mode='queue' and (c.status in ('pending_review','flagged','hidden','removed') or c.review_required)) or
 (p_mode in ('browse','saved') and c.status='published' and not exists(select 1 from public.community_recipe_hides h where h.recipe_id=c.id and h.user_id=u)
 and (p_mode='browse' or exists(select 1 from public.community_recipe_saves b where b.recipe_id=c.id and b.user_id=u)))
 order by ordering limit 30 offset greatest(coalesce(p_offset,0),0)
 ) q;
 return result;
end $$;
create or replace function public.community_save_draft(p_id uuid,p_data jsonb,p_revision integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.community_recipes; x jsonb;
begin
 if u is null then raise exception 'Sign in to save a recipe.'; end if;
 if p_id is null or p_data is null or jsonb_typeof(p_data)<>'object' or length(p_data::text)>25000 then raise exception 'Recipe data is invalid or too long.'; end if;
 if jsonb_typeof(p_data->'ingredients') is distinct from 'array' or jsonb_typeof(p_data->'steps') is distinct from 'array' or jsonb_typeof(p_data->'double_check_tags') is distinct from 'array' or jsonb_typeof(p_data->'use_case_tags') is distinct from 'array' then raise exception 'Recipe lists are invalid.'; end if;
 if jsonb_array_length(p_data->'ingredients')>30 or jsonb_array_length(p_data->'steps')>30 then raise exception 'Use no more than 30 ingredients or steps.'; end if;
 if coalesce(p_data->>'category','') not in ('','Breakfast','Lunch','Dinner','Snack','Dessert','Drink','Sauce/Dip','Other') or coalesce(p_data->>'effort_level','') not in ('','Quick & Easy','A Little Prep','Weekend Project') then raise exception 'Choose a listed category and effort.'; end if;
 for x in select value from jsonb_array_elements(p_data->'ingredients') loop
 if jsonb_typeof(x)<>'object' or jsonb_typeof(x->'ingredient_text') is distinct from 'string' or jsonb_typeof(x->'amount_text') is distinct from 'string' or length(x->>'ingredient_text')>200 or length(x->>'amount_text')>80 then raise exception 'Check ingredient names and amounts.'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p_data->'steps') loop
 if jsonb_typeof(x)<>'string' or length(x#>>'{}')>600 then raise exception 'Keep each step under 600 characters.'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p_data->'double_check_tags') loop
 if jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('Brand matters','Check the label','Cross-contact may matter','Use a GF-certified/labeled version','Nothing special','Not sure') then raise exception 'Choose listed double-check tags.'; end if;
 end loop;
 if (p_data->'double_check_tags') ? 'Nothing special' and jsonb_array_length(p_data->'double_check_tags')>1 then raise exception 'Nothing special cannot be combined with other checks.'; end if;
 for x in select value from jsonb_array_elements(p_data->'use_case_tags') loop
 if jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('School lunch','After school','Family dinner','Party','Travel','Make ahead') then raise exception 'Choose listed use-case tags.'; end if;
 end loop;
 insert into public.community_member_reputation(user_id) values(u) on conflict do nothing;
 -- Insert first to serialize retries creating the same draft; then lock and check revision.
 insert into public.community_recipes(id,author_user_id,revision) values(p_id,u,0) on conflict do nothing;
 select * into r from public.community_recipes where id=p_id for update;
 if r.author_user_id<>u or r.status<>'draft' then raise exception 'Only your own draft can be edited.'; end if;
 if r.revision<>p_revision then raise exception 'This draft changed elsewhere. Reopen it before editing.'; end if;
 update public.community_recipes set title=coalesce(p_data->>'title',''),category=coalesce(p_data->>'category',''),effort_level=coalesce(p_data->>'effort_level',''),
 ingredients=p_data->'ingredients',steps=p_data->'steps',double_check_tags=p_data->'double_check_tags',use_case_tags=p_data->'use_case_tags',friend_tip=coalesce(p_data->>'friend_tip',''),updated_at=now(),revision=revision+1
 where id=p_id returning * into r;
 return public.community_recipe_json(r);
end $$;
create or replace function public.community_submit(p_id uuid,p_revision integer,p_ack jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.community_recipes; begin
 select * into r from public.community_recipes where id=p_id for update;
 if auth.uid() is null or r.id is null or r.author_user_id<>auth.uid() then raise exception 'Not authorized.'; end if;
 if r.status='pending_review' then return public.community_recipe_json(r); end if;
 if r.status<>'draft' or r.revision<>p_revision then raise exception 'Reopen your draft before submitting.'; end if;
 if p_ack is distinct from '[true,true,true]'::jsonb then raise exception 'Please accept all three acknowledgements.'; end if;
 if length(btrim(r.title))=0 or r.category='' or r.effort_level='' or jsonb_array_length(r.ingredients)=0 or jsonb_array_length(r.steps)=0
 or exists(select 1 from jsonb_array_elements(r.ingredients) x where length(btrim(x->>'ingredient_text'))=0 or length(btrim(x->>'amount_text'))=0)
 or exists(select 1 from jsonb_array_elements_text(r.steps) x where length(btrim(x))=0) then raise exception 'Add a title, category, effort, ingredients with amounts, and steps.'; end if;
 update public.community_recipes set status='pending_review',review_required=true,acknowledgement_version='community-v1',acknowledgements=p_ack,submitted_at=now(),updated_at=now(),revision=revision+1 where id=p_id returning * into r;
 return public.community_recipe_json(r);
end $$;
create or replace function public.community_interact(p_id uuid,p_action text,p_enabled boolean default true,p_reason text default '',p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.community_recipes; begin
 if u is null then raise exception 'Sign in to use Community.'; end if;
 select * into r from public.community_recipes where id=p_id for update;
 if r.id is null or r.status<>'published' then raise exception 'This recipe is no longer published.'; end if;
 if p_action='save' then
 if p_enabled then insert into public.community_recipe_saves(recipe_id,user_id) values(p_id,u) on conflict do nothing; else delete from public.community_recipe_saves where recipe_id=p_id and user_id=u; end if;
 elsif p_action='helpful' then
 if p_enabled then insert into public.community_recipe_reactions(recipe_id,user_id) values(p_id,u) on conflict do nothing; else delete from public.community_recipe_reactions where recipe_id=p_id and user_id=u; end if;
 elsif p_action='hide' then
 insert into public.community_recipe_hides(recipe_id,user_id) values(p_id,u) on conflict do nothing;
 elsif p_action='report' then
 insert into public.community_reports(recipe_id,reporter_user_id,reason_code,optional_note) values(p_id,u,p_reason,coalesce(p_note,'')) on conflict(recipe_id,reporter_user_id) do nothing;
 insert into public.community_recipe_hides(recipe_id,user_id) values(p_id,u) on conflict do nothing;
 update public.community_recipes set review_required=true where id=p_id;
 else raise exception 'Unknown action.'; end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.community_moderate(p_id uuid,p_action text,p_reason text default '',p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.community_recipes; next_status text; begin
 if not public.community_is_moderator() then raise exception 'Moderator access required.'; end if;
 if p_action not in ('approve','hide','remove','restore','resolve_reports') or p_action is null then raise exception 'Unknown moderation action.'; end if;
 if p_action<>'approve' and length(btrim(coalesce(p_reason,'')))=0 then raise exception 'A reason is required.'; end if;
 if length(coalesce(p_reason,''))>100 or length(coalesce(p_note,''))>1000 then raise exception 'Moderation note is too long.'; end if;
 select * into r from public.community_recipes where id=p_id for update;
 if r.id is null or r.status='draft' then raise exception 'Only submitted recipes can be moderated.'; end if;
 if p_action='approve' and r.status<>'pending_review' then raise exception 'Only pending recipes can be approved.'; end if;
 if p_action='restore' and r.status not in ('hidden','removed','flagged') then raise exception 'Only hidden or removed recipes can be restored.'; end if;
 next_status:=case p_action when 'approve' then 'published' when 'restore' then case when r.published_at is null then 'pending_review' else 'published' end when 'hide' then 'hidden' when 'remove' then 'removed' else r.status end;
 update public.community_recipes set status=next_status,review_required=(next_status='pending_review'),published_at=case when p_action='approve' then now() else published_at end,updated_at=now(),revision=revision+1 where id=p_id returning * into r;
 update public.community_reports set status='resolved',resolved_at=now() where recipe_id=p_id and status<>'resolved';
 insert into public.community_moderation_actions(recipe_id,action,moderator_user_id,reason_code,note) values(p_id,p_action,auth.uid(),coalesce(nullif(btrim(p_reason),''),'publication_review'),coalesce(p_note,''));
 return public.community_recipe_json(r);
end $$;
revoke all on function public.community_is_moderator(),public.community_recipe_json(public.community_recipes),public.community_read(text,uuid,integer),public.community_save_draft(uuid,jsonb,integer),public.community_submit(uuid,integer,jsonb),public.community_interact(uuid,text,boolean,text,text),public.community_moderate(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.community_read(text,uuid,integer),public.community_save_draft(uuid,jsonb,integer),public.community_submit(uuid,integer,jsonb),public.community_interact(uuid,text,boolean,text,text),public.community_moderate(uuid,text,text,text) to authenticated;
commit;
