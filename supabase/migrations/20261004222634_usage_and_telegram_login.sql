-- Public profile images are immutable files, rather than part of every directory row.
-- Uploads go through the authenticated server; client roles cannot write this bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',true,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

-- A website login is approved in the bot's signed Mini App. No session tokens or
-- browser secrets are stored here. Only the original browser can consume it once.
create table public.telegram_browser_logins (
 id uuid primary key,
 secret_hash text not null check(length(secret_hash)=64),
 link_user_id uuid references auth.users(id) on delete cascade,
 telegram_id bigint check(telegram_id>0),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
alter table public.telegram_browser_logins enable row level security;
revoke all on public.telegram_browser_logins from anon,authenticated;
grant select,insert,update,delete on public.telegram_browser_logins to service_role;
create index telegram_browser_login_expiry on public.telegram_browser_logins(expires_at);

-- Coalesce activity from multiple tabs without losing the two-minute online window.
create or replace function public.touch_activity() returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not private.account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
 insert into public.user_activity(user_id,last_seen_at) values(auth.uid(),now())
 on conflict(user_id) do update set last_seen_at=excluded.last_seen_at
 where public.user_activity.last_seen_at < now()-interval '50 seconds';
 -- The existing sync_activity trigger updates the practitioner's heartbeat once.
end $$;
revoke all on function public.touch_activity() from public,anon;
grant execute on function public.touch_activity() to authenticated;

-- Booking changes replace constant background polling; RLS still selects recipients.
alter policy own_live_updates on realtime.messages using (
 extension='broadcast' and private.account_active((select auth.uid())) and
 realtime.topic() in ('directory:'||(select auth.uid())::text,'wallet:'||(select auth.uid())::text,'appointments:'||(select auth.uid())::text)
);
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='appointments') then
  alter publication supabase_realtime add table public.appointments;
 end if;
end $$;
