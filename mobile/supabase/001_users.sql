-- Run once in your Supabase project's SQL Editor before creating accounts.
begin;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null
);

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
grant update (first_name, last_name) on public.users to authenticated;

create policy "Users can read their own record"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);
create policy "Users can update their own name"
  on public.users for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auth owns the identity and email. Clients cannot insert arbitrary users.
create function public.sync_app_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke execute on function public.sync_app_user() from public, anon, authenticated;

create trigger sync_app_user
  after insert or update of email on auth.users
  for each row execute function public.sync_app_user();

-- Include any accounts created before this setup.
insert into public.users (id, first_name, last_name, email)
select id, coalesce(raw_user_meta_data ->> 'first_name', ''),
  coalesce(raw_user_meta_data ->> 'last_name', ''), coalesce(email, '')
from auth.users;

commit;
