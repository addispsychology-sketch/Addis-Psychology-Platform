alter table public.telegram_accounts add column verified_phone text unique
  check (verified_phone ~ '^\+[1-9][0-9]{7,14}$');

create table public.auth_attempt_windows (
  key_hash text primary key,
  started_at timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.auth_attempt_windows enable row level security;
revoke all on public.auth_attempt_windows from anon, authenticated;
grant all on public.auth_attempt_windows to service_role;

create function public.claim_phone_login(key_value text, attempt_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare used integer;
begin
  if length(key_value) <> 64 or attempt_limit not between 1 and 100 then
    raise exception 'Invalid rate limit';
  end if;
  insert into public.auth_attempt_windows as w(key_hash) values (key_value)
  on conflict (key_hash) do update set
    attempts = case when w.started_at < now() - interval '15 minutes' then 1 else least(w.attempts + 1, 101) end,
    started_at = case when w.started_at < now() - interval '15 minutes' then now() else w.started_at end
  returning attempts into used;
  return used <= attempt_limit;
end;
$$;
revoke all on function public.claim_phone_login(text, integer) from public, anon, authenticated;
grant execute on function public.claim_phone_login(text, integer) to service_role;
