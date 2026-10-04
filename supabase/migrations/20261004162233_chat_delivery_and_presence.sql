-- Authorize both current and legacy private voice references without regex escaping ambiguity.
alter policy send_messages on public.messages with check (
 sender_id=(select auth.uid()) and private.is_participant(conversation_id)
 and (audio_url is null or audio_url ~ ('^/api/voice[?]key='||conversation_id::text||'%2F'||(select auth.uid())::text||'%2F[a-f0-9-]{36}(&storage=(supabase|r2))?$'))
);
alter policy read_conversation_voice on storage.objects using (
 bucket_id='voice-notes' and exists(select 1 from public.messages m where m.audio_url in (
 '/api/voice?key='||replace(name,'/','%2F'),
 '/api/voice?key='||replace(name,'/','%2F')||'&storage=supabase'))
);

-- Reads advance only to a message actually loaded by a participant, and never backwards.
create function public.mark_conversation_read(conversation uuid,last_message uuid) returns void
language plpgsql security definer set search_path='' as $$
declare seen timestamptz; begin
 if not private.account_active(auth.uid()) or not private.is_participant(conversation) then raise exception 'Conversation unavailable'; end if;
 select created_at into seen from public.messages where id=last_message and conversation_id=conversation;
 if seen is null then raise exception 'Message unavailable'; end if;
 insert into public.conversation_reads(user_id,conversation_id,read_at) values(auth.uid(),conversation,seen)
 on conflict(user_id,conversation_id) do update set read_at=greatest(public.conversation_reads.read_at,excluded.read_at);
end $$;
revoke all on function public.mark_conversation_read(uuid,uuid) from public,anon;
grant execute on function public.mark_conversation_read(uuid,uuid) to authenticated;

-- Typing/recording events are ephemeral and restricted to this conversation's participants.
create policy activity_receive on realtime.messages for select to authenticated using (
 extension='broadcast' and private.account_active((select auth.uid())) and exists(select 1 from public.conversations c where 'typing:'||c.id::text=realtime.topic() and private.is_participant(c.id))
);
create policy activity_send on realtime.messages for insert to authenticated with check (
 extension='broadcast' and private.account_active((select auth.uid())) and exists(select 1 from public.conversations c where 'typing:'||c.id::text=realtime.topic() and private.is_participant(c.id))
);

create index notification_message_pending on public.notification_jobs(recipient,conversation_id) where kind='message' and delivered_at is null;
create or replace function private.queue_message_notification() returns trigger language plpgsql security definer set search_path='' as $$
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

create or replace function private.queue_admin_alert() returns trigger language plpgsql security definer set search_path='' as $$
declare target text; alert_kind text; detail text; booking uuid; begin
 alert_kind:=case when tg_table_name='appointments' then 'admin_booking' else 'admin_payment' end;
 if alert_kind='admin_booking' then
  booking:=new.id;
  select 'A new appointment request for '||coalesce(profile->>'name','a practitioner')||' needs your review.' into detail from public.practitioners where id=new.therapist_id;
 else
  detail:=initcap(new.kind)||' package · '||((new.principal_cents+new.fee_cents)::numeric/100)::text||' ETB · '||upper(new.method)||'. A payment screenshot is ready for verification.';
 end if;
 for target in select trim(value) from regexp_split_to_table(coalesce((select value from public.platform_config where key='telegram_admin_ids'),''),',') value loop
 if target ~ '^[0-9]+$' then
 insert into public.notification_jobs(admin_chat_id,channel,kind,path,summary,dedupe_key,appointment_id)
 values(target::bigint,'telegram',alert_kind,'/admin',detail,alert_kind||':'||new.id::text||':'||target,booking);
 end if; end loop; return new;
end $$;
