-- Account-owned Explore progress. Existing canonical content and Plan XP are unchanged.
begin;
create table public.explore_user_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 content_id uuid not null references public.explore_content(content_id),
 content_type text not null check(content_type in ('QUICK_LEARN','MYTH_OR_FACT','PRACTICE_A_SKILL','REAL_LIFE_CHALLENGE')),
 status text not null default 'started' check(status in ('started','tried','completed')),
 saved boolean not null default false,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 reflection text,
 xp_awarded integer not null default 0 check(xp_awarded>=0),
 imported_from_device boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,content_id),
 check((status='completed' and completed_at is not null) or (status<>'completed' and completed_at is null and xp_awarded=0 and reflection is null))
);
alter table public.explore_user_progress enable row level security;
revoke all on public.explore_user_progress from public,anon,authenticated;
grant select on public.explore_user_progress to authenticated;
create policy explore_progress_owner_read on public.explore_user_progress for select to authenticated using(user_id=(select auth.uid()));
create function public.save_explore_progress(p_expected_user uuid,p_content_id uuid,p_operation text,p_reflection text default null,p_legacy jsonb default null)
returns public.explore_user_progress language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); c public.explore_content%rowtype; r public.explore_user_progress%rowtype; next_status text; amount integer; reflected text; finished timestamptz;
begin
 if u is null or u<>p_expected_user then raise exception 'Sign in again before saving progress'; end if;
 if p_operation not in ('start','tried','complete','save','unsave','import') then raise exception 'Invalid progress operation'; end if;
 select * into c from public.explore_content where content_id=p_content_id;
 if not found or c.content_type not in ('QUICK_LEARN','MYTH_OR_FACT','PRACTICE_A_SKILL','REAL_LIFE_CHALLENGE') then raise exception 'Unknown Explore activity'; end if;
 if p_operation<>'import' and not c.active then raise exception 'Activity is unavailable'; end if;
 if p_operation in ('save','unsave') and c.content_type<>'QUICK_LEARN' then raise exception 'Only Quick Learn has saved lessons'; end if;
 if p_operation='tried' and c.content_type<>'REAL_LIFE_CHALLENGE' then raise exception 'Only challenges have a tried stage'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_content_id::text,0));
 insert into public.explore_user_progress(user_id,content_id,content_type) values(u,p_content_id,c.content_type) on conflict do nothing;
 select * into r from public.explore_user_progress where user_id=u and content_id=p_content_id for update;
 if p_operation in ('save','unsave') then
  update public.explore_user_progress set saved=(p_operation='save'),updated_at=now() where user_id=u and content_id=p_content_id returning * into r;return r;
 end if;
 if r.status='completed' then return r;end if;
 next_status:=case when p_operation='complete' then 'completed' when p_operation='tried' then 'tried' else r.status end;
 amount:=coalesce(c.xp_value,0);reflected:=p_reflection;finished:=now();
 if p_operation='import' then
  if p_legacy is null or p_legacy->>'content_type'<>c.content_type then raise exception 'Legacy activity type mismatch';end if;
  next_status:=p_legacy->>'status';
  if next_status not in ('started','tried','completed') then raise exception 'Invalid legacy status';end if;
  amount:=(p_legacy->>'xp')::integer;
  if amount is null or amount<0 or amount>coalesce(c.xp_value,0) or (next_status<>'completed' and amount<>0) then raise exception 'Legacy XP requires review';end if;
  reflected:=p_legacy->>'reflection';finished:=coalesce((p_legacy->>'completed_at')::timestamptz,now());
  if finished>now()+interval '5 minutes' then raise exception 'Invalid completion date';end if;
 end if;
 if next_status='completed' and c.content_type='REAL_LIFE_CHALLENGE' then
  if p_operation<>'import' and r.status<>'tried' then raise exception 'Finish the adventure before reflecting';end if;
  if reflected is null or not coalesce((c.content_body->'reflection_options') ? reflected,false) then raise exception 'Choose a reflection response';end if;
 elsif c.content_type<>'REAL_LIFE_CHALLENGE' then reflected:=null;
 end if;
 -- Imports never regress an existing tried record or replace an existing award.
 if r.status='tried' and next_status='started' then next_status:='tried';end if;
 update public.explore_user_progress set status=next_status,
  saved=r.saved or (p_operation='import' and c.content_type='QUICK_LEARN' and coalesce((p_legacy->>'saved')::boolean,false)),
  started_at=case when p_operation='import' then least(r.started_at,coalesce((p_legacy->>'started_at')::timestamptz,r.started_at)) else r.started_at end,
  completed_at=case when next_status='completed' then finished else null end,
  reflection=case when next_status='completed' then reflected else null end,
  xp_awarded=case when next_status='completed' then amount else 0 end,
  imported_from_device=r.imported_from_device or p_operation='import',updated_at=now()
 where user_id=u and content_id=p_content_id returning * into r;
 return r;
end $$;
revoke all on function public.save_explore_progress(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.save_explore_progress(uuid,uuid,text,text,jsonb) to authenticated;
commit;
