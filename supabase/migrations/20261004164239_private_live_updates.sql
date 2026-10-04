create policy own_live_updates on realtime.messages for select to authenticated using (
 extension='broadcast' and private.account_active((select auth.uid())) and realtime.topic() in ('directory:'||(select auth.uid())::text,'wallet:'||(select auth.uid())::text)
);
