create or replace function private.queue_message_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient_id uuid; destination text; online boolean; begin
 select case when new.sender_id=c.client_id then p.user_id else c.client_id end,
 case when new.sender_id=c.client_id then '/portal?conversation='||c.id::text else '/chat?therapist='||c.therapist_id::text end
 into recipient_id,destination from public.conversations c join public.practitioners p on p.id=c.therapist_id where c.id=new.conversation_id;
 
 select (now() - last_seen_at) < interval '2 minutes' into online from public.user_activity where user_id=recipient_id;
 if coalesce(online, false) is false then
   insert into public.notification_jobs(recipient,channel,kind,path,summary,dedupe_key,conversation_id,message_at)
   values(recipient_id,'telegram','message',destination,'A new private message is waiting.','message:'||new.id::text,new.conversation_id,new.created_at);
 end if;
 return new;
end $$;
