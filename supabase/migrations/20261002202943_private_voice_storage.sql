begin;
alter policy send_messages on public.messages with check (
  sender_id = auth.uid() and private.is_participant(conversation_id)
  and (audio_url is null or audio_url ~ ('^/api/voice\?key=' || conversation_id::text || '%2F' || auth.uid()::text || '%2F[a-f0-9-]{36}(&storage=supabase)?$'))
);
create policy upload_own_voice on storage.objects for insert to authenticated with check (
  bucket_id = 'voice-notes'
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}$'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.conversations c where c.id::text = split_part(name, '/', 1))
);
create policy read_conversation_voice on storage.objects for select to authenticated using (
  bucket_id = 'voice-notes'
  and exists (
    select 1 from public.messages m
    where m.audio_url = '/api/voice?key=' || replace(name, '/', '%2F') || '&storage=supabase'
  )
);
commit;
