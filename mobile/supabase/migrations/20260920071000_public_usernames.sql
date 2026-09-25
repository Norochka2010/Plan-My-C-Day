begin;
alter table public.account_profiles add column username_public boolean not null default false;
create or replace function public.initialize_account_profile() returns trigger
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
  insert into public.account_profiles(user_id,date_of_birth,username,username_public) values(new.id,birthday,nullif(lower(trim(new.raw_user_meta_data->>'username')),''),new.raw_user_meta_data->>'username' is not null);
  return new;
end; $$;
create or replace function public.save_account_profile(p_expected_user uuid,p_first_name text,p_last_name text,p_dob date,p_username text)
returns void language plpgsql security definer set search_path='' as $$
declare existing_dob date; normalized text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise exception 'Please sign in again.'; end if;
  if length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(trim(coalesce(p_last_name,''))) not between 1 and 80 then
    raise exception 'Enter a first name up to 80 characters and a last name up to 80 characters.';
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
  insert into public.account_profiles(user_id,date_of_birth,username,username_public) values(auth.uid(),p_dob,normalized,normalized is not null)
    on conflict(user_id) do update set date_of_birth=coalesce(account_profiles.date_of_birth,excluded.date_of_birth),username=excluded.username,username_public=excluded.username_public,updated_at=now();
exception when unique_violation then raise exception 'That username is unavailable. Please choose another.';
end; $$;
create or replace function public.community_recipe_json(r public.community_recipes) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'effort_level',r.effort_level,
 'ingredients',r.ingredients,'steps',r.steps,'double_check_tags',r.double_check_tags,'use_case_tags',r.use_case_tags,'friend_tip',r.friend_tip,
 'status',r.status,'revision',r.revision,'submitted_at',r.submitted_at,'published_at',r.published_at,
 'author_username',(select p.username from public.account_profiles p where p.user_id=r.author_user_id and p.username_public),
 'is_author',r.author_user_id=auth.uid(),
 'saved',exists(select 1 from public.community_recipe_saves where recipe_id=r.id and user_id=auth.uid()),
 'helpful',exists(select 1 from public.community_recipe_reactions where recipe_id=r.id and user_id=auth.uid()))
$$;

create function public.username_available(p_username text) returns boolean language sql stable security definer set search_path='' as $$
select lower(trim(p_username)) ~ '^[a-z][a-z0-9_]{2,23}$'
and lower(trim(p_username)) !~ '(admin|moderator|official|support)'
and not exists(select 1 from public.account_profiles where username=lower(trim(p_username)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
commit;
