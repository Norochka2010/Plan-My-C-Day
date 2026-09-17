-- Stage 4: social extensions; UI applicability is not Meyer simulation evidence.
begin;
update public.action_library set event_tags=array_append(event_tags,'party')
where source='Meyer_2021' and not ('party'=any(event_tags)) and id in ('ask_03','ask_07','ask_08','ask_09','ask_10','prepare_05','prepare_06','prepare_07','check_03','check_06','check_09','take_01','take_04','take_06','collaborate_03','collaborate_05','collaborate_06','call_04','call_05','say_03','say_05','say_06','say_08');
update public.action_library set event_tags=array_append(event_tags,'friends_house')
where source='Meyer_2021' and not ('friends_house'=any(event_tags)) and id in ('ask_03','ask_07','ask_08','prepare_02','prepare_05','prepare_07','check_03','check_06','take_01','take_04','take_06','collaborate_01','collaborate_03','collaborate_05','call_02','call_05','call_06','say_01','say_05','say_07','say_10');
CREATE OR REPLACE FUNCTION "public"."complete_c_day_reflection"("p_event_id" "uuid", "p_helpfulness" "text", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_notes" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."c_day_events"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target public.c_day_events;
begin
 select * into target from public.c_day_events where id=p_event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if target.status='completed' then return next target; return; end if;
 if target.status<>'planned' or target.event_type not in ('dinner_with_friends','school_event','travel','party','friends_house') or target.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
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
  if old.status<>'planned' or new.event_type not in ('dinner_with_friends','school_event','travel','party','friends_house') or old.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
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
 if not found or parent.status<>'planned' or parent.event_start_at>now() or parent.event_type not in ('dinner_with_friends','school_event','travel','party','friends_house') then raise exception 'Reflection tags require a past planned C-Day; completed history is read only'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
commit;
