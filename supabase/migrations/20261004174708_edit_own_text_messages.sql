alter table public.messages add column edited_at timestamptz;

-- Only the original sender may edit text; voice notes and message identity stay immutable.
grant update(text) on public.messages to authenticated;
create policy edit_own_text_messages on public.messages for update to authenticated
using (
 sender_id=(select auth.uid()) and audio_url is null and text is not null
 and private.account_active((select auth.uid())) and private.is_participant(conversation_id)
)
with check (
 sender_id=(select auth.uid()) and audio_url is null and text is not null
 and length(trim(text)) between 1 and 2000
 and private.account_active((select auth.uid())) and private.is_participant(conversation_id)
);
create function private.stamp_message_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.text:=trim(new.text);
 if new.text is distinct from old.text then new.edited_at:=statement_timestamp(); end if;
 return new;
end $$;
revoke all on function private.stamp_message_edit() from public,anon,authenticated;
create trigger stamp_message_edit before update of text on public.messages
for each row execute function private.stamp_message_edit();
