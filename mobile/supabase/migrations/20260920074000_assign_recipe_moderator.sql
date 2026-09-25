begin;
do $$
declare selected_user uuid;
begin
 select id into selected_user from auth.users where lower(email)='noraimsf@mycday.com' and email_confirmed_at is not null;
 if selected_user is null then raise exception 'The selected moderator account must exist and have a verified email first.'; end if;
 insert into public.community_moderators(user_id,active) values(selected_user,true)
 on conflict(user_id) do update set active=true;
end; $$;
commit;
