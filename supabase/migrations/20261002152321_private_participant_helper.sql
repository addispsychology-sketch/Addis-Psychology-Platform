begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_participant(uuid) set schema private;
revoke all on function private.is_participant(uuid) from public, anon;
grant execute on function private.is_participant(uuid) to authenticated;
commit;
