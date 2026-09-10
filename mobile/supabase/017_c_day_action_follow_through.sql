-- Stage 4: follow-through only. Apply after 014, 015 and 016.
begin;
alter table public.c_day_actions add column if not exists completed_at timestamptz;
create or replace function public.guard_c_day_action() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare parent public.c_day_events; item public.action_library; selected_count integer;
begin
 if tg_op='DELETE' then
  select * into parent from public.c_day_events where id=old.c_day_event_id for update;
  if old.native_calendar_event_id is not null then raise exception 'Linked calendar event must be handled before removal'; end if;
  if found and parent.status<>'draft' then raise exception 'Only draft actions can be removed'; end if;
  return old;
 end if;
 select * into parent from public.c_day_events where id=new.c_day_event_id for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.c_day_event_id<>old.c_day_event_id or new.action_library_id<>old.action_library_id then raise exception 'Selected action identity cannot change'; end if;
  new.action_text_snapshot:=old.action_text_snapshot;
  new.source_snapshot:=old.source_snapshot;
  new.source_version_snapshot:=old.source_version_snapshot;
 end if;
 if parent.status='planned' then
  if tg_op<>'UPDATE' then raise exception 'Cannot add actions to a finalized plan'; end if;
  if (to_jsonb(new)-array['scheduled_at','schedule_value','schedule_unit','completion_status','completed_at','reschedule_count','calendar_sync_enabled','calendar_sync_status','native_calendar_event_id','calendar_sync_message','updated_at'])
   is distinct from (to_jsonb(old)-array['scheduled_at','schedule_value','schedule_unit','completion_status','completed_at','reschedule_count','calendar_sync_enabled','calendar_sync_status','native_calendar_event_id','calendar_sync_message','updated_at']) then
    raise exception 'Follow-through cannot change action difficulty or identity';
  end if;
  if old.completion_status<>'planned' and (new.completion_status<>old.completion_status or new.scheduled_at is distinct from old.scheduled_at or new.schedule_value is distinct from old.schedule_value or new.schedule_unit<>old.schedule_unit) then
   raise exception 'This action already has a follow-through result';
  end if;
  if new.scheduled_at is null or new.difficulty is null then raise exception 'A finalized action must stay configured'; end if;
  if new.scheduled_at is distinct from old.scheduled_at then
   if new.completion_status<>'planned' or new.scheduled_at<=now() then raise exception 'Choose a future time for rescheduling'; end if;
  end if;
  if new.completion_status='done' then new.completed_at:=coalesce(old.completed_at,now()); else new.completed_at:=null; end if;
 elsif parent.status='draft' then
  if new.completion_status<>'planned' then raise exception 'Finalize the C-Day before follow-through'; end if;
  new.completed_at:=null;
  select count(*) into selected_count from public.c_day_actions where c_day_event_id=new.c_day_event_id and id<>new.id and completion_status<>'not_needed';
  if selected_count>=6 then raise exception 'A draft can contain at most six actions'; end if;
  if tg_op='INSERT' then
   select * into item from public.action_library where id=new.action_library_id and active and review_status='approved';
   if not found then raise exception 'Action is not available'; end if;
   new.action_text_snapshot:=item.action_text;new.source_snapshot:=item.source;new.source_version_snapshot:=item.content_version;
  end if;
 else raise exception 'This C-Day cannot be changed in this stage';
 end if;
 if new.scheduled_at>parent.event_start_at then raise exception 'Action must be scheduled no later than the C-Day'; end if;
 if tg_op='INSERT' then new.reschedule_count:=0;
 else new.reschedule_count:=old.reschedule_count+case when new.scheduled_at <> old.scheduled_at then 1 else 0 end;
 end if;
 new.updated_at:=now();return new;
end $$;
create or replace function public.guard_c_day_event() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare action_count integer;
begin
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

-- Parent first, then action: repeated requests serialize and terminal results are idempotent.
create or replace function public.follow_through_c_day_action(
 p_action_id uuid,p_choice text,p_scheduled_at timestamptz default null,
 p_schedule_value integer default null,p_schedule_unit text default 'custom')
returns setof public.c_day_actions language plpgsql security invoker set search_path=public,pg_temp as $$
declare event_id uuid; parent public.c_day_events; target public.c_day_actions;
begin
 if p_choice not in ('done','reschedule','not_needed') or p_choice is null then raise exception 'Invalid follow-through choice'; end if;
 select c_day_event_id into event_id from public.c_day_actions where id=p_action_id;
 select * into parent from public.c_day_events where id=event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if parent.status<>'planned' then raise exception 'Follow-through requires a finalized C-Day'; end if;
 select * into target from public.c_day_actions where id=p_action_id for update;
 if not found or target.scheduled_at is null then raise exception 'Scheduled action not found'; end if;
 if target.completion_status=p_choice then return next target; return; end if;
 if target.completion_status<>'planned' then raise exception 'This action already has a follow-through result'; end if;
 if p_choice='reschedule' then
  if p_scheduled_at is null then raise exception 'Choose a date and time'; end if;
  if target.scheduled_at=p_scheduled_at then return next target; return; end if;
  if p_scheduled_at<=now() or p_scheduled_at>parent.event_start_at then raise exception 'Choose a future time no later than your C-Day'; end if;
  update public.c_day_actions set scheduled_at=p_scheduled_at,schedule_value=p_schedule_value,schedule_unit=p_schedule_unit,
   completion_status='planned',calendar_sync_status=case when calendar_sync_enabled or native_calendar_event_id is not null then 'pending' else 'not_requested' end,
   calendar_sync_message=case when calendar_sync_enabled or native_calendar_event_id is not null then 'Calendar changes are deferred. Saved in My Plan only.' else null end
  where id=p_action_id returning * into target;
 else
  update public.c_day_actions set completion_status=p_choice,
   calendar_sync_status=case when p_choice='not_needed' and (calendar_sync_enabled or native_calendar_event_id is not null) then 'pending' else calendar_sync_status end,
   calendar_sync_message=case when p_choice='not_needed' and (calendar_sync_enabled or native_calendar_event_id is not null) then 'Calendar changes are deferred. No phone calendar event was changed.' else calendar_sync_message end
  where id=p_action_id returning * into target;
 end if;
 return next target;
end $$;
revoke all on function public.follow_through_c_day_action(uuid,text,timestamptz,integer,text) from public,anon;
grant execute on function public.follow_through_c_day_action(uuid,text,timestamptz,integer,text) to authenticated;
commit;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='c_day_actions' and column_name='completed_at';
