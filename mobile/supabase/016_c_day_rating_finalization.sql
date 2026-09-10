-- Stage 3 only: separate event self-rating and validated finalization.
-- Requires 014 then 015. Does not modify action records or add completion.
begin;
alter table public.c_day_events add column if not exists plan_rating smallint;
alter table public.c_day_events drop constraint if exists c_day_events_plan_rating_check;
alter table public.c_day_events add constraint c_day_events_plan_rating_check check (plan_rating between 1 and 5);
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
 if action_count > 6 or (new.status in ('planned','completed') and action_count < 2) then
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

create or replace function public.finalize_c_day(p_event_id uuid,p_rating smallint)
returns setof public.c_day_events language plpgsql security invoker set search_path=public,pg_temp as $$
declare target public.c_day_events; total integer; configured integer;
begin
 select * into target from public.c_day_events where id=p_event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 -- A retry after a lost response must not modify the already-finalized plan.
 if target.status='planned' then return next target; return; end if;
 if target.status<>'draft' then raise exception 'Only a draft can be finalized'; end if;
 if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a plan rating from 1 to 5'; end if;
 select count(*),count(*) filter (where scheduled_at is not null and difficulty is not null)
 into total,configured from public.c_day_actions where c_day_event_id=target.id and completion_status<>'not_needed';
 if total<2 or total>6 or configured<>total then raise exception 'Finalization requires 2–6 configured actions'; end if;
 update public.c_day_events set plan_rating=p_rating,status='planned' where id=target.id returning * into target;
 return next target;
end $$;
revoke all on function public.finalize_c_day(uuid,smallint) from public,anon;
grant execute on function public.finalize_c_day(uuid,smallint) to authenticated;
commit;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='c_day_events' and column_name='plan_rating';
