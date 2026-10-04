create or replace function private.queue_incoming_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient_id uuid; destination text; pending bigint; begin
 select case when new.sender_id=c.client_id then p.user_id else c.client_id end,
 case when new.sender_id=c.client_id then '/portal?conversation='||c.id::text else '/chat?therapist='||c.therapist_id::text end
 into recipient_id,destination from public.conversations c join public.practitioners p on p.id=c.therapist_id where c.id=new.conversation_id;
 if exists(select 1 from public.user_activity where user_id=recipient_id and last_seen_at>now()-interval '2 minutes') then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.conversation_id::text||recipient_id::text,0));
 select id into pending from public.notification_jobs where recipient=recipient_id and conversation_id=new.conversation_id and kind='message' and delivered_at is null and lease_until is null order by id limit 1;
 if pending is not null then
  update public.notification_jobs set message_at=new.created_at where id=pending;
 else
  insert into public.notification_jobs(recipient,channel,kind,path,summary,dedupe_key,conversation_id,message_at,due_at)
  values(recipient_id,'telegram','message',destination,'A new private message is waiting.','message:'||new.id::text,new.conversation_id,new.created_at,now()+interval '20 seconds');
 end if;
 return new;
end $$;


revoke all on function private.queue_incoming_notification() from public,anon,authenticated;
drop trigger message_notification on public.messages;
create trigger message_notification after insert on public.messages for each row execute function private.queue_incoming_notification();
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='practitioners') then
  alter publication supabase_realtime add table public.practitioners;
 end if;
end $$;

-- Supabase-managed scheduler extensions; the local test harness models their API separately.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.configure_notification_worker(worker_url text,worker_secret text) returns void
language plpgsql security definer set search_path='' as $$
declare existing uuid; begin
 if worker_url <> 'https://addis-psychology-platform.vercel.app/api/jobs/notifications' or length(worker_secret)<32 then raise exception 'Invalid worker configuration'; end if;
 select id into existing from vault.secrets where name='addis_notification_worker_secret';
 if existing is null then perform vault.create_secret(worker_secret,'addis_notification_worker_secret');
 else perform vault.update_secret(existing,worker_secret); end if;
 insert into public.platform_config(key,value) values('notification_worker_url',worker_url) on conflict(key) do update set value=excluded.value;
end $$;
revoke all on function public.configure_notification_worker(text,text) from public,anon,authenticated;
grant execute on function public.configure_notification_worker(text,text) to service_role;

create function private.wake_notifications() returns void language plpgsql security definer set search_path='' as $$
declare destination text; credential text; begin
 if not exists(select 1 from public.notification_jobs where delivered_at is null and attempts<8 and due_at<=now() and (lease_until is null or lease_until<now())) then return; end if;
 destination:='https://addis-psychology-platform.vercel.app/api/jobs/notifications';
 select decrypted_secret into credential from vault.decrypted_secrets where name='addis_notification_worker_secret';
 if destination is null or credential is null then return; end if;
 perform net.http_post(url:=destination,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function private.wake_notifications() from public,anon,authenticated;
select cron.schedule('addis-notification-delivery','* * * * *','select private.wake_notifications()');
