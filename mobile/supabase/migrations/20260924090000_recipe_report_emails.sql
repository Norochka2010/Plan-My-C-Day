begin;
alter table public.recipe_email_queue add column report_id uuid references public.community_reports(id) on delete cascade;
alter table public.recipe_email_queue drop constraint recipe_email_queue_recipe_id_revision_key;
create unique index recipe_submission_email_unique on public.recipe_email_queue(recipe_id,revision) where report_id is null;
create unique index recipe_report_email_unique on public.recipe_email_queue(report_id) where report_id is not null;
create function public.queue_recipe_report_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.recipe_email_queue(recipe_id,revision,report_id)
 select new.recipe_id,r.revision,new.id from public.community_recipes r where r.id=new.recipe_id
 on conflict do nothing;
 return new;
end $$;
revoke all on function public.queue_recipe_report_notification() from public,anon,authenticated;
create trigger notify_recipe_report after insert on public.community_reports
for each row execute function public.queue_recipe_report_notification();
-- Catch unresolved reports submitted before email notification was connected.
insert into public.recipe_email_queue(recipe_id,revision,report_id)
 select r.id,r.revision,p.id from public.community_reports p join public.community_recipes r on r.id=p.recipe_id
 where p.status in ('open','reviewing') on conflict do nothing;
commit;
