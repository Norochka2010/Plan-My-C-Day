begin;
create table public.recipe_email_queue (
 id uuid primary key default gen_random_uuid(),
 recipe_id uuid not null references public.community_recipes(id) on delete cascade,
 revision integer not null,
 created_at timestamptz not null default now(),
 next_attempt_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(recipe_id,revision)
);
alter table public.recipe_email_queue enable row level security;
revoke all on public.recipe_email_queue from public,anon,authenticated;
grant all on public.recipe_email_queue to service_role;
create function public.queue_recipe_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending_review' and old.status is distinct from new.status then
  insert into public.recipe_email_queue(recipe_id,revision) values(new.id,new.revision) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.queue_recipe_notification() from public,anon,authenticated;
create trigger notify_recipe_review after update of status on public.community_recipes
 for each row execute function public.queue_recipe_notification();
create function public.claim_recipe_notifications() returns setof public.recipe_email_queue
language sql security definer set search_path='' as $$
 update public.recipe_email_queue set next_attempt_at=now()+interval '5 minutes'
 where id in (select id from public.recipe_email_queue where sent_at is null and next_attempt_at<=now() order by created_at for update skip locked limit 5)
 returning *;
$$;
revoke all on function public.claim_recipe_notifications() from public,anon,authenticated;
grant execute on function public.claim_recipe_notifications() to service_role;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('recipe-moderation-email','* * * * *',
 $job$select net.http_post(url:='https://rowewbnnggapsxlcnkwb.supabase.co/functions/v1/recipe-moderation-email',body:='{}'::jsonb);$job$);
commit;
