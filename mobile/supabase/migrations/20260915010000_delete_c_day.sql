-- Allow whole-plan deletion without loosening individual action editing rules.
begin;
do $migration$
declare fname text; definition text;
begin
 foreach fname in array array['guard_c_day_action','guard_c_day_reflection_tag'] loop
  definition := pg_get_functiondef(('public.' || fname || '()')::regprocedure);
  definition := regexp_replace(definition, '\mbegin\M', E'begin\n if TG_OP = ''DELETE'' then\n  if not exists (select 1 from public.c_day_events where id=OLD.c_day_event_id) then return OLD; end if;\n end if;', 'i');
  execute definition;
 end loop;
end $migration$;
create or replace function public.delete_c_day(p_event_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 delete from public.c_day_events where id=p_event_id and user_id=auth.uid() and status in ('draft','planned');
 if not found then raise exception 'Draft or plan not found'; end if;
end $$;
revoke all on function public.delete_c_day(uuid) from public, anon;
grant execute on function public.delete_c_day(uuid) to authenticated;
commit;
