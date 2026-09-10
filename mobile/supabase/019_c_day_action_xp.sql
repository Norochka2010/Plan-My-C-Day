-- Stage 6 provisional XP. Apply after 014–018; preserves Stage 5 event/history guards.
-- Existing Done records remain at 0; no retroactive awards or historical outcome changes.
begin;
alter table public.c_day_actions add column if not exists xp_awarded integer not null default 0;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='c_day_action_xp_check' and conrelid='public.c_day_actions'::regclass) then
  alter table public.c_day_actions add constraint c_day_action_xp_check check(xp_awarded>=0 and (completion_status='done' or xp_awarded=0));
 end if;
end $$;
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
 -- Ignore client-supplied XP. Only the validated Done transition below can award it.
 if tg_op='INSERT' then new.xp_awarded:=0; else new.xp_awarded:=old.xp_awarded; end if;
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
 -- Store a single award atomically with Done; retries and later metadata writes retain it.
 if tg_op='UPDATE' and old.completion_status='planned' and new.completion_status='done' then
  new.xp_awarded:=case old.difficulty when 'easy' then 5 when 'moderate' then 7 when 'hard' then 9 else 0 end;
 end if;
 new.updated_at:=now();return new;
end $$;
commit;
select column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema='public' and table_name='c_day_actions' and column_name='xp_awarded';
