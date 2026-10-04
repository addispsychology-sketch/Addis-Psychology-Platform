-- INSERT RETURNING must recognize the new client's row without re-querying it.
alter policy own_conversations on public.conversations using (client_id=(select auth.uid()) or private.is_participant(id));

alter table public.practitioners add column last_seen_at timestamptz;
create table public.user_activity(user_id uuid primary key references auth.users(id) on delete cascade, last_seen_at timestamptz not null default now());
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon,authenticated;
grant select,insert,update on public.user_activity to authenticated;
grant all on public.user_activity to service_role;
create policy own_activity on public.user_activity for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and last_seen_at<=now() and private.account_active((select auth.uid())));
create function private.sync_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.practitioners set last_seen_at=new.last_seen_at where user_id=new.user_id; return new; end $$;
revoke all on function private.sync_activity() from public,anon,authenticated;
create trigger sync_activity after insert or update on public.user_activity for each row execute function private.sync_activity();
create function public.touch_activity() returns void language sql security invoker set search_path='' as $$
 insert into public.user_activity(user_id,last_seen_at) values(auth.uid(),now()) on conflict(user_id) do update set last_seen_at=excluded.last_seen_at;
$$;
revoke all on function public.touch_activity() from public,anon;
grant execute on function public.touch_activity() to authenticated;

-- Store the conversation for read-aware notification suppression.
alter table public.notification_jobs add column conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.notification_jobs add column message_at timestamptz;
alter table public.notification_jobs add column admin_chat_id bigint;
alter table public.notification_jobs alter column recipient drop not null;
alter table public.notification_jobs add constraint notification_destination check(recipient is not null or admin_chat_id is not null);
alter table public.notification_jobs drop constraint notification_jobs_kind_check;
alter table public.notification_jobs add constraint notification_jobs_kind_check check(kind in ('message','appointment','reminder','payment','admin_booking','admin_payment'));
create table public.platform_config(key text primary key,value text not null);
alter table public.platform_config enable row level security;
revoke all on public.platform_config from public,anon,authenticated;
grant all on public.platform_config to service_role;

create or replace function private.queue_message_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient_id uuid; destination text; begin
 select case when new.sender_id=c.client_id then p.user_id else c.client_id end,
 case when new.sender_id=c.client_id then '/portal?conversation='||c.id::text else '/chat?therapist='||c.therapist_id::text end
 into recipient_id,destination from public.conversations c join public.practitioners p on p.id=c.therapist_id where c.id=new.conversation_id;
 insert into public.notification_jobs(recipient,channel,kind,path,summary,dedupe_key,conversation_id,message_at)
 values(recipient_id,'telegram','message',destination,'A new private message is waiting.','message:'||new.id::text,new.conversation_id,new.created_at);
 return new;
end $$;

create function private.queue_admin_alert() returns trigger language plpgsql security definer set search_path='' as $$
declare target text; alert_kind text; begin
 alert_kind:=case when tg_table_name='appointments' then 'admin_booking' else 'admin_payment' end;
 for target in select trim(value) from regexp_split_to_table(coalesce((select value from public.platform_config where key='telegram_admin_ids'),''),',') value loop
 if target ~ '^[0-9]+$' then
 insert into public.notification_jobs(admin_chat_id,channel,kind,path,summary,dedupe_key)
 values(target::bigint,'telegram',alert_kind,'/admin',case when alert_kind='admin_booking' then 'A new appointment request needs your review.' else 'A package payment screenshot is ready for verification.' end,alert_kind||':'||new.id::text||':'||target);
 end if; end loop; return new;
end $$;
revoke all on function private.queue_admin_alert() from public,anon,authenticated;
create trigger admin_booking_alert after insert on public.appointments for each row execute function private.queue_admin_alert();
create trigger admin_payment_alert after insert on public.payment_requests for each row execute function private.queue_admin_alert();

create table public.channel_posts(id uuid primary key, actor uuid not null references auth.users(id), title text not null, body text not null, therapist_id bigint references public.practitioners(id), status text not null default 'draft' check(status in ('draft','publishing','published','failed')), telegram_message_id bigint, created_at timestamptz not null default now());
alter table public.channel_posts enable row level security;
revoke all on public.channel_posts from public,anon,authenticated;
grant all on public.channel_posts to service_role;
