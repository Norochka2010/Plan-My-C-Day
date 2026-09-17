begin;
-- Completed history stays read-only for edits, but owners can explicitly delete it.
-- Direct table DELETE remains revoked; deletion is available only via the owner-checked RPC.
drop trigger if exists protect_completed_c_day on public.c_day_events;
create or replace function public.delete_c_day(p_event_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 delete from public.c_day_events where id=p_event_id and user_id=auth.uid() and status in ('draft','planned','completed');
 if not found then raise exception 'C-Day not found'; end if;
end $$;
revoke all on function public.delete_c_day(uuid) from public, anon;
grant execute on function public.delete_c_day(uuid) to authenticated;
commit;
