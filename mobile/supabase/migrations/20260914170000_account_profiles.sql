begin;
-- Additive only: existing auth users, sessions and app records are untouched.
create table public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date,
  username text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_username_format check (username is null or
    (username ~ '^[a-z][a-z0-9_]{2,23}$' and username !~ '(admin|moderator|official|support)'))
);
alter table public.account_profiles enable row level security;
revoke all on public.account_profiles from public, anon, authenticated;
grant select on public.account_profiles to authenticated;
create policy account_profile_owner_read on public.account_profiles for select to authenticated using(user_id=auth.uid());

create function public.validate_account_dob(p_dob date) returns void
language plpgsql set search_path='' as $$
begin
  if p_dob is null or p_dob > (current_date - interval '13 years')::date then
    raise exception 'You must be 13 or older to create an account.';
  end if;
end; $$;
revoke all on function public.validate_account_dob(date) from public, anon, authenticated;

-- Only new accounts are gated. Updates (including email confirmation) are unaffected.
create function public.initialize_account_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare birthday date; raw_dob text;
begin
  raw_dob := new.raw_user_meta_data->>'date_of_birth';
  if raw_dob is null or raw_dob !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'A valid date of birth is required for new accounts.';
  end if;
  birthday := raw_dob::date;
  perform public.validate_account_dob(birthday);
  if length(trim(coalesce(new.raw_user_meta_data->>'first_name',''))) not between 1 and 80 then
    raise exception 'Enter your first name.';
  end if;
  insert into public.account_profiles(user_id,date_of_birth) values(new.id,birthday);
  return new;
end; $$;
revoke all on function public.initialize_account_profile() from public, anon, authenticated;
create trigger initialize_private_account_profile after insert on auth.users
for each row execute function public.initialize_account_profile();

create function public.save_account_profile(p_expected_user uuid,p_first_name text,p_last_name text,p_dob date,p_username text)
returns void language plpgsql security definer set search_path='' as $$
declare existing_dob date; normalized text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise exception 'Please sign in again.'; end if;
  if length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(coalesce(p_last_name,''))>80 then
    raise exception 'Enter a first name up to 80 characters and an optional last name up to 80 characters.';
  end if;
  select date_of_birth into existing_dob from public.account_profiles where user_id=auth.uid();
  if existing_dob is not null and p_dob is distinct from existing_dob then
    raise exception 'Your saved date of birth cannot be changed here.';
  end if;
  if p_dob is not null then perform public.validate_account_dob(p_dob); end if;
  normalized := nullif(lower(trim(p_username)),'');
  if normalized is not null and (normalized !~ '^[a-z][a-z0-9_]{2,23}$' or normalized ~ '(admin|moderator|official|support)') then
    raise exception 'Choose 3–24 characters: start with a letter, then letters, numbers or underscores. Avoid staff names.';
  end if;
  update public.users set first_name=trim(p_first_name),last_name=trim(coalesce(p_last_name,'')) where id=auth.uid();
  insert into public.account_profiles(user_id,date_of_birth,username) values(auth.uid(),p_dob,normalized)
    on conflict(user_id) do update set date_of_birth=coalesce(account_profiles.date_of_birth,excluded.date_of_birth),username=excluded.username,updated_at=now();
exception when unique_violation then raise exception 'That username is unavailable. Please choose another.';
end; $$;
revoke all on function public.save_account_profile(uuid,text,text,date,text) from public,anon,authenticated;
grant execute on function public.save_account_profile(uuid,text,text,date,text) to authenticated;
commit;
