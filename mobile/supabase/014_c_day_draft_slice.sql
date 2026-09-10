-- Dinner With Friends: draft-only first slice. Run in Supabase SQL Editor / Database.
-- Does not change Explore, profiles, authentication, or existing app tables.
begin;
create table if not exists public.c_day_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null,
 title text not null check (length(trim(title)) > 0),
 venue_name text,
 event_start_at timestamptz not null,
 event_timezone text not null,
 status text not null default 'draft' check (status in ('draft','planned','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.action_library (
 id text primary key,
 category text not null check (category in ('ASK','PREPARE','CHECK','AVOID','TAKE','COLLABORATE','CALL','SAY')),
 action_text text not null,
 source text not null,
 content_version numeric not null default 1.0,
 active boolean not null default true
);
create table if not exists public.c_day_actions (
 id uuid primary key default gen_random_uuid(),
 c_day_event_id uuid not null references public.c_day_events(id) on delete cascade,
 action_library_id text not null references public.action_library(id),
 action_text_snapshot text not null,
 source_snapshot text not null,
 source_version_snapshot numeric not null,
 scheduled_at timestamptz not null,
 schedule_value integer,
 schedule_unit text not null default 'custom' check (schedule_unit in ('hours','days','weeks','custom')),
 difficulty text not null check (difficulty in ('easy','moderate','hard')),
 completion_status text not null default 'planned' check (completion_status in ('planned','done','not_needed')),
 reschedule_count integer not null default 0 check (reschedule_count >= 0),
 calendar_sync_enabled boolean not null default false,
 calendar_sync_status text not null default 'not_requested' check (calendar_sync_status in ('not_requested','pending','synced','denied','failed')),
 native_calendar_event_id text,
 calendar_sync_message text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (c_day_event_id, action_library_id),
 check ((schedule_unit = 'custom' and schedule_value is null) or (schedule_unit <> 'custom' and schedule_value > 0)),
 check (calendar_sync_status <> 'synced' or native_calendar_event_id is not null)
);
create index if not exists c_day_events_owner_date on public.c_day_events(user_id,status,event_start_at);
create index if not exists c_day_actions_event_schedule on public.c_day_actions(c_day_event_id,scheduled_at);

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
 new.updated_at := now();
 return new;
end $$;
create or replace function public.guard_c_day_action() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare parent public.c_day_events; item public.action_library; selected_count integer;
begin
 if tg_op = 'DELETE' then
  select * into parent from public.c_day_events where id = old.c_day_event_id for update;
  -- A parent cascade may already have removed the parent.
  if found and parent.status <> 'draft' then raise exception 'Only draft actions can be removed in this slice'; end if;
  return old;
 end if;
 select * into parent from public.c_day_events where id = new.c_day_event_id for update;
 if not found then raise exception 'Plan does not exist or is not accessible'; end if;
 if parent.status <> 'draft' then raise exception 'Only drafts can be edited in this slice'; end if;
 select count(*) into selected_count from public.c_day_actions
  where c_day_event_id = new.c_day_event_id and id <> new.id and completion_status <> 'not_needed';
 if new.completion_status <> 'not_needed' and selected_count >= 6 then raise exception 'A draft can contain at most six actions'; end if;
 if new.scheduled_at > parent.event_start_at then raise exception 'Action must be scheduled no later than the C-Day'; end if;
 if tg_op = 'INSERT' then
  select * into item from public.action_library where id = new.action_library_id and active;
  if not found then raise exception 'Action is not available'; end if;
  new.action_text_snapshot := item.action_text;
  new.source_snapshot := item.source;
  new.source_version_snapshot := item.content_version;
  new.reschedule_count := 0;
 else
  if new.id <> old.id or new.c_day_event_id <> old.c_day_event_id or new.action_library_id <> old.action_library_id then
   raise exception 'Selected action identity cannot change';
  end if;
  new.action_text_snapshot := old.action_text_snapshot;
  new.source_snapshot := old.source_snapshot;
  new.source_version_snapshot := old.source_version_snapshot;
  new.reschedule_count := old.reschedule_count + case when new.scheduled_at <> old.scheduled_at then 1 else 0 end;
 end if;
 new.updated_at := now();
 return new;
end $$;
drop trigger if exists c_day_event_guard on public.c_day_events;
create trigger c_day_event_guard before insert or update on public.c_day_events for each row execute function public.guard_c_day_event();
drop trigger if exists c_day_action_guard on public.c_day_actions;
create trigger c_day_action_guard before insert or update or delete on public.c_day_actions for each row execute function public.guard_c_day_action();

alter table public.c_day_events enable row level security;
alter table public.action_library enable row level security;
alter table public.c_day_actions enable row level security;
revoke all on public.c_day_events, public.c_day_actions, public.action_library from anon, authenticated;
grant select, insert, update on public.c_day_events, public.c_day_actions to authenticated;
grant select on public.action_library to authenticated;
drop policy if exists c_day_events_owner on public.c_day_events;
create policy c_day_events_owner on public.c_day_events for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists c_day_actions_owner on public.c_day_actions;
create policy c_day_actions_owner on public.c_day_actions for all to authenticated
 using (exists (select 1 from public.c_day_events e where e.id = c_day_event_id and e.user_id = (select auth.uid())))
 with check (exists (select 1 from public.c_day_events e where e.id = c_day_event_id and e.user_id = (select auth.uid())));
drop policy if exists action_library_read on public.action_library;
create policy action_library_read on public.action_library for select to authenticated using (active);
insert into public.action_library(id,category,action_text,source,content_version,active)
 values ('call_01','CALL','Call the restaurant','Meyer_2021',1.0,true)
 on conflict (id) do nothing;
commit;
select id,category,action_text,source,content_version from public.action_library where id='call_01';
