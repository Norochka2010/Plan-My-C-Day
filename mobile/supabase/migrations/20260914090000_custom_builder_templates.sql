-- Signature custom C-Day: private explicit context and reusable selections only.
begin;
alter table public.c_day_events add column custom_context jsonb;
alter table public.c_day_events add column builder_version text;
alter table public.action_library add column context_tags text[] not null default '{}';
comment on column public.action_library.context_tags is 'Product applicability for deterministic custom Builder ranking; not Meyer source findings.';
create table public.c_day_plan_templates (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),context_tags text[] not null default '{}',
 source_event_id uuid references public.c_day_events(id) on delete set null,active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,source_event_id)
);
create table public.c_day_plan_template_actions (
 template_id uuid not null references public.c_day_plan_templates(id) on delete cascade,
 action_library_id text not null references public.action_library(id),action_text_snapshot text not null,
 source_snapshot text not null,source_version_snapshot numeric not null,sort_order integer not null,
 primary key(template_id,action_library_id)
);
alter table public.c_day_plan_templates enable row level security;
alter table public.c_day_plan_template_actions enable row level security;
create policy templates_read_own on public.c_day_plan_templates for select to authenticated using(user_id=(select auth.uid()));
create policy template_actions_read_own on public.c_day_plan_template_actions for select to authenticated using(exists(select 1 from public.c_day_plan_templates t where t.id=template_id and t.user_id=(select auth.uid())));
revoke all on public.c_day_plan_templates,public.c_day_plan_template_actions from anon,authenticated;
grant select on public.c_day_plan_templates,public.c_day_plan_template_actions to authenticated;
create function public.save_c_day_builder(p_event_id uuid,p_answers jsonb) returns setof public.c_day_events
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.c_day_events;k text;v jsonb;choice text;tags text[];allowed jsonb:='{"day":["friends","school","travel","sports","celebration","overnight","other"],"food":["restaurant","host_cooking","food_provided","bring_own","uncertain_food_context"],"support":["support_friend","support_family","support_teacher","support_host","support_staff","mostly_me"],"familiarity":["familiar","new_context","new_context_total"],"ready":["food_information","backup","communication","ask_ahead","collaborate","not_sure"]}';
begin
 select * into e from public.c_day_events where id=p_event_id and user_id=auth.uid() for update;
 if not found or e.event_type<>'custom' or e.status<>'draft' then raise exception 'Open your custom draft to edit the Builder';end if;
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid Builder answers';end if;
 for k,v in select * from jsonb_each(p_answers) loop
  if not allowed ? k or jsonb_typeof(v) is distinct from 'array' then raise exception 'Invalid Builder answer';end if;
  if jsonb_array_length(v)>7 or (k in ('day','food','familiarity') and jsonb_array_length(v)>1) then raise exception 'Invalid selection count';end if;
  if exists(select 1 from jsonb_array_elements(v) a where jsonb_typeof(a) <> 'string') then raise exception 'Invalid Builder selection';end if;
  for choice in select jsonb_array_elements_text(v) loop
   if not (allowed->k) ? choice then raise exception 'Choose a listed Builder answer';end if;
  end loop;
 end loop;
 select coalesce(array_agg(distinct x),'{}') into tags from jsonb_each(p_answers) a cross join lateral jsonb_array_elements_text(a.value) x;
 update public.c_day_events set custom_context=jsonb_build_object('answers',p_answers,'tags',tags),builder_version='custom_builder_v1' where id=e.id returning * into e;
 return next e;
end $$;
create function public.save_c_day_template(p_event_id uuid,p_title text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.c_day_events;t uuid;
begin
 select * into e from public.c_day_events where id=p_event_id and user_id=auth.uid() for update;
 if not found or e.event_type<>'custom' or e.status<>'completed' then raise exception 'Save a template after reflecting on your custom C-Day';end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 then raise exception 'Enter a saved-plan title of 1–200 characters';end if;
 insert into public.c_day_plan_templates(user_id,title,context_tags,source_event_id)
 values(auth.uid(),btrim(p_title),array(select jsonb_array_elements_text(coalesce(e.custom_context->'tags','[]'))),e.id)
 on conflict(user_id,source_event_id) do update set title=excluded.title,active=true,updated_at=now() returning id into t;
 delete from public.c_day_plan_template_actions where template_id=t;
 insert into public.c_day_plan_template_actions(template_id,action_library_id,action_text_snapshot,source_snapshot,source_version_snapshot,sort_order)
 select t,action_library_id,action_text_snapshot,source_snapshot,source_version_snapshot,row_number() over(order by scheduled_at,id)::integer
 from public.c_day_actions where c_day_event_id=e.id and completion_status<>'not_needed';
 return t;
end $$;
create function public.use_c_day_template(p_event_id uuid,p_template_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.c_day_events;added integer;unavailable integer;
begin
 select * into e from public.c_day_events where id=p_event_id and user_id=auth.uid() for update;
 if not found or e.event_type<>'custom' or e.status<>'draft' then raise exception 'Open your custom draft to use a saved plan';end if;
 perform 1 from public.c_day_plan_templates where id=p_template_id and user_id=auth.uid() and active for update;
 if not found then raise exception 'Saved plan not available';end if;
 if exists(select 1 from public.c_day_actions a where a.c_day_event_id=e.id and not exists(select 1 from public.c_day_plan_template_actions t where t.template_id=p_template_id and t.action_library_id=a.action_library_id)) then raise exception 'Use a saved plan before choosing other actions';end if;
 select count(*) into unavailable from public.c_day_plan_template_actions t join public.action_library l on l.id=t.action_library_id where t.template_id=p_template_id and (not l.active or l.review_status<>'approved');
 insert into public.c_day_actions(c_day_event_id,action_library_id,scheduled_at,difficulty)
 select e.id,t.action_library_id,null,null from public.c_day_plan_template_actions t join public.action_library l on l.id=t.action_library_id
 where t.template_id=p_template_id and l.active and l.review_status='approved'
 and not exists(select 1 from public.c_day_actions a where a.c_day_event_id=e.id and a.action_library_id=t.action_library_id)
 order by t.sort_order;
 get diagnostics added=row_count;
 return jsonb_build_object('added',added,'unavailable',unavailable);
end $$;
revoke all on function public.save_c_day_builder(uuid,jsonb),public.save_c_day_template(uuid,text),public.use_c_day_template(uuid,uuid) from public,anon;
grant execute on function public.save_c_day_builder(uuid,jsonb),public.save_c_day_template(uuid,text),public.use_c_day_template(uuid,uuid) to authenticated;
CREATE OR REPLACE FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_notes" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."c_day_events"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target public.c_day_events;
begin
 select * into target from public.c_day_events where id=p_event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if target.status='completed' then return next target; return; end if;
 if target.status<>'planned' or target.event_type not in ('dinner_with_friends','school_event','travel','party','friends_house','sports','custom') or target.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
 if p_helpfulness is null then raise exception 'Choose how helpful your plan felt'; end if;
 delete from public.c_day_reflection_tags where c_day_event_id=p_event_id;
 insert into public.c_day_reflection_tags(c_day_event_id,tag) select p_event_id,t from (select distinct unnest(p_tags) t) tags;
 update public.c_day_events set reflection_helpfulness=p_helpfulness,reflection_notes=nullif(btrim(p_notes),''),status='completed' where id=p_event_id returning * into target;
 return next target;
end $$;

CREATE OR REPLACE FUNCTION "public"."guard_c_day_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare action_count integer;
begin
 if tg_op='UPDATE' and old.status='completed' then raise exception 'Completed C-Day history is read only'; end if;
 if new.status='completed' then
  if tg_op<>'UPDATE' then raise exception 'Complete a planned C-Day through reflection'; end if;
  if old.status<>'planned' or new.event_type not in ('dinner_with_friends','school_event','travel','party','friends_house','sports','custom') or old.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
  if new.reflection_helpfulness is null then raise exception 'Choose how helpful your plan felt'; end if;
  if (to_jsonb(new)-array['reflection_helpfulness','reflection_notes','reflected_at','status','updated_at']) is distinct from
     (to_jsonb(old)-array['reflection_helpfulness','reflection_notes','reflected_at','status','updated_at']) then raise exception 'Reflection must preserve the original plan'; end if;
  new.reflected_at:=now();
 elsif new.reflection_helpfulness is not null or new.reflection_notes is not null or new.reflected_at is not null then
  raise exception 'Reflection is saved when completing a C-Day';
 end if;
 if not exists (select 1 from pg_timezone_names where name = new.event_timezone) then
  raise exception 'Invalid event timezone';
 end if;
 if tg_op = 'UPDATE' and (new.id <> old.id or new.user_id <> old.user_id) then
  raise exception 'Event identity cannot change';
 end if;
 select count(*) into action_count from public.c_day_actions
  where c_day_event_id = new.id and completion_status <> 'not_needed';
 if action_count > 6 or (new.status in ('planned','completed') and action_count < 2 and (tg_op='INSERT' or old.status='draft')) then
  raise exception 'Finalized plans require 2–6 actions; drafts allow 0–6';
 end if;
 if exists (select 1 from public.c_day_actions where c_day_event_id = new.id and scheduled_at > new.event_start_at) then
  raise exception 'Event cannot be earlier than its preparation actions';
 end if;
 if new.status in ('planned','completed') and exists (select 1 from public.c_day_actions where c_day_event_id=new.id and completion_status <> 'not_needed' and (scheduled_at is null or difficulty is null)) then
  raise exception 'Actions must be configured before finalization';
 end if;
 if new.status in ('planned','completed') and new.plan_rating is null then raise exception 'Choose a plan rating before finalization'; end if;
 if tg_op='UPDATE' and old.status='planned' and new.status='draft' then raise exception 'Reopening a finalized plan is not supported in this stage'; end if;
 new.updated_at := now();
 return new;
end $$;

CREATE OR REPLACE FUNCTION "public"."guard_c_day_reflection_tag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare parent public.c_day_events;
begin
 select * into parent from public.c_day_events where id=case when tg_op='DELETE' then old.c_day_event_id else new.c_day_event_id end for update;
 if not found or parent.status<>'planned' or parent.event_start_at>now() or parent.event_type not in ('dinner_with_friends','school_event','travel','party','friends_house','sports','custom') then raise exception 'Reflection tags require a past planned C-Day; completed history is read only'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

update public.action_library set context_tags=array_append(context_tags,'friends') where source='Meyer_2021' and not ('friends'=any(context_tags)) and id in ('call_02','say_05','collaborate_04');

update public.action_library set context_tags=array_append(context_tags,'school') where source='Meyer_2021' and not ('school'=any(context_tags)) and id in ('ask_06','ask_10','check_06','say_03');

update public.action_library set context_tags=array_append(context_tags,'travel') where source='Meyer_2021' and not ('travel'=any(context_tags)) and id in ('check_02','check_03','take_05','take_06','take_07');

update public.action_library set context_tags=array_append(context_tags,'sports') where source='Meyer_2021' and not ('sports'=any(context_tags)) and id in ('check_06','take_06','call_04');

update public.action_library set context_tags=array_append(context_tags,'celebration') where source='Meyer_2021' and not ('celebration'=any(context_tags)) and id in ('ask_07','collaborate_06','take_01');

update public.action_library set context_tags=array_append(context_tags,'overnight') where source='Meyer_2021' and not ('overnight'=any(context_tags)) and id in ('call_02','collaborate_01','take_01');

update public.action_library set context_tags=array_append(context_tags,'restaurant') where source='Meyer_2021' and not ('restaurant'=any(context_tags)) and id in ('call_01','check_08','ask_01','say_02');

update public.action_library set context_tags=array_append(context_tags,'host_cooking') where source='Meyer_2021' and not ('host_cooking'=any(context_tags)) and id in ('ask_03','collaborate_03','call_02');

update public.action_library set context_tags=array_append(context_tags,'food_provided') where source='Meyer_2021' and not ('food_provided'=any(context_tags)) and id in ('ask_09','check_06','say_10');

update public.action_library set context_tags=array_append(context_tags,'bring_own') where source='Meyer_2021' and not ('bring_own'=any(context_tags)) and id in ('take_01','take_04','take_06','prepare_02');

update public.action_library set context_tags=array_append(context_tags,'uncertain_food_context') where source='Meyer_2021' and not ('uncertain_food_context'=any(context_tags)) and id in ('ask_07','check_09','call_04');

update public.action_library set context_tags=array_append(context_tags,'support_friend') where source='Meyer_2021' and not ('support_friend'=any(context_tags)) and id in ('say_05','collaborate_04');

update public.action_library set context_tags=array_append(context_tags,'support_family') where source='Meyer_2021' and not ('support_family'=any(context_tags)) and id in ('collaborate_01','call_06','say_01');

update public.action_library set context_tags=array_append(context_tags,'support_teacher') where source='Meyer_2021' and not ('support_teacher'=any(context_tags)) and id in ('ask_06','say_03');

update public.action_library set context_tags=array_append(context_tags,'support_host') where source='Meyer_2021' and not ('support_host'=any(context_tags)) and id in ('ask_03','call_02');

update public.action_library set context_tags=array_append(context_tags,'support_staff') where source='Meyer_2021' and not ('support_staff'=any(context_tags)) and id in ('ask_06','call_04');

update public.action_library set context_tags=array_append(context_tags,'food_information') where source='Meyer_2021' and not ('food_information'=any(context_tags)) and id in ('ask_03','check_06','check_09');

update public.action_library set context_tags=array_append(context_tags,'backup') where source='Meyer_2021' and not ('backup'=any(context_tags)) and id in ('take_01','take_04','take_07');

update public.action_library set context_tags=array_append(context_tags,'communication') where source='Meyer_2021' and not ('communication'=any(context_tags)) and id in ('say_05','say_07','say_08');

update public.action_library set context_tags=array_append(context_tags,'ask_ahead') where source='Meyer_2021' and not ('ask_ahead'=any(context_tags)) and id in ('ask_04','call_04','call_07');

update public.action_library set context_tags=array_append(context_tags,'collaborate') where source='Meyer_2021' and not ('collaborate'=any(context_tags)) and id in ('collaborate_01','collaborate_03','collaborate_05');
commit;
