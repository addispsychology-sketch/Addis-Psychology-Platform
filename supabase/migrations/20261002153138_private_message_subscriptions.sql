-- Authorize each user's private subscription topic. Postgres Changes still
-- applies the conversation/message table policies to every delivered row.
create policy own_message_subscription on realtime.messages
for select to authenticated using (
  extension = 'broadcast'
  and realtime.topic() = 'messages:' || (select auth.uid())::text
);
