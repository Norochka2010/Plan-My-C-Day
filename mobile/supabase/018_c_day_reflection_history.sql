-- Stage 5 only. Apply after migrations 014–017. No existing plan/content is rewritten.
begin;
alter table public.c_day_events add column if not exists reflection_helpfulness text;
alter table public.c_day_events add column if not exists reflection_notes text;
alter table public.c_day_events add column if not exists reflected_at timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='c_day_reflection_helpfulness_check' and conrelid='public.c_day_events'::regclass) then
 alter table public.c_day_events add constraint c_day_reflection_helpfulness_check check(reflection_helpfulness in ('Not helpful yet','A little helpful','Helpful','Very helpful','Not sure'));
 end if;
 if not exists(select 1 from pg_constraint where conname='c_day_reflection_notes_check' and conrelid='public.c_day_events'::regclass) then
 alter table public.c_day_events add constraint c_day_reflection_notes_check check(char_length(reflection_notes)<=2000);
 end if;
end $$;
create table if not exists public.c_day_reflection_tags (
 id uuid primary key default gen_random_uuid(),
 c_day_event_id uuid not null references public.c_day_events(id) on delete cascade,
 tag text not null check(tag in ('Planning ahead','Asking questions','Getting support','Communicating my needs','Using reminders','Adapting my plan')),
 created_at timestamptz not null default now(),
 unique(c_day_event_id,tag)
);
alter table public.c_day_reflection_tags enable row level security;
drop policy if exists c_day_reflection_tags_owner on public.c_day_reflection_tags;
create policy c_day_reflection_tags_owner on public.c_day_reflection_tags for all to authenticated
 using(exists(select 1 from public.c_day_events e where e.id=c_day_event_id and e.user_id=(select auth.uid())))
 with check(exists(select 1 from public.c_day_events e where e.id=c_day_event_id and e.user_id=(select auth.uid())));
grant select,insert,delete on public.c_day_reflection_tags to authenticated;
create or replace function public.guard_c_day_reflection_tag() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent public.c_day_events;
begin
 select * into parent from public.c_day_events where id=case when tg_op='DELETE' then old.c_day_event_id else new.c_day_event_id end for update;
 if not found or parent.status<>'planned' or parent.event_start_at>now() or parent.event_type<>'dinner_with_friends' then raise exception 'Reflection tags require a past planned C-Day; completed history is read only'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists guard_c_day_reflection_tag on public.c_day_reflection_tags;
create trigger guard_c_day_reflection_tag before insert or update or delete on public.c_day_reflection_tags for each row execute function public.guard_c_day_reflection_tag();
create or replace function public.guard_c_day_event() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare action_count integer;
begin
 if tg_op='UPDATE' and old.status='completed' then raise exception 'Completed C-Day history is read only'; end if;
 if new.status='completed' then
  if tg_op<>'UPDATE' then raise exception 'Complete a planned C-Day through reflection'; end if;
  if old.status<>'planned' or new.event_type<>'dinner_with_friends' or old.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
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


-- Prevent deleting completed history through direct owner requests.
create or replace function public.protect_completed_c_day() returns trigger language plpgsql as $$
begin
 if old.status='completed' then raise exception 'Completed C-Day history is read only'; end if;
 return old;
end $$;
drop trigger if exists protect_completed_c_day on public.c_day_events;
create trigger protect_completed_c_day before delete on public.c_day_events for each row execute function public.protect_completed_c_day();
-- Locks the same parent row as follow-through; the entire reflection commits atomically.
create or replace function public.complete_c_day_reflection(p_event_id uuid,p_helpfulness text,p_tags text[] default null,p_notes text default null)
returns setof public.c_day_events language plpgsql security invoker set search_path=public,pg_temp as $$
declare target public.c_day_events;
begin
 select * into target from public.c_day_events where id=p_event_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Plan not found or not accessible'; end if;
 if target.status='completed' then return next target; return; end if;
 if target.status<>'planned' or target.event_type<>'dinner_with_friends' or target.event_start_at>now() then raise exception 'Reflection is available after your planned C-Day event time'; end if;
 if p_helpfulness is null then raise exception 'Choose how helpful your plan felt'; end if;
 delete from public.c_day_reflection_tags where c_day_event_id=p_event_id;
 insert into public.c_day_reflection_tags(c_day_event_id,tag) select p_event_id,t from (select distinct unnest(p_tags) t) tags;
 update public.c_day_events set reflection_helpfulness=p_helpfulness,reflection_notes=nullif(btrim(p_notes),''),status='completed' where id=p_event_id returning * into target;
 return next target;
end $$;
revoke all on function public.complete_c_day_reflection(uuid,text,text[],text) from public,anon;
grant execute on function public.complete_c_day_reflection(uuid,text,text[],text) to authenticated;
commit;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='c_day_events' and column_name in ('reflection_helpfulness','reflection_notes','reflected_at') order by column_name;
