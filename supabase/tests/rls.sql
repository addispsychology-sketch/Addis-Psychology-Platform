-- Run after the migration in the SQL editor. Everything rolls back; no test data remains.
begin;
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000002'),
('00000000-0000-4000-8000-000000000003');
insert into public.practitioners(id, user_id, profile, approved) overriding system value values
(-1, '00000000-0000-4000-8000-000000000002', '{}', true);
insert into public.conversations(id, client_id, therapist_id) values
('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', -1);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
insert into public.messages(conversation_id, sender_id, text) values
('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'RLS test');
do $$ begin
  if (select count(*) from public.messages where conversation_id = '00000000-0000-4000-8000-000000000004') <> 1 then raise exception 'Client cannot read own conversation'; end if;
  begin
    insert into public.messages(conversation_id,sender_id,text) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','Forged sender');
    raise exception 'FAIL: forged sender accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.messages(conversation_id,sender_id,audio_url) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','/api/voice?key=00000000-0000-4000-8000-000000000004%2F00000000-0000-4000-8000-000000000003%2F00000000-0000-4000-8000-000000000005');
    raise exception 'FAIL: another user audio path accepted';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.messages(conversation_id,sender_id,audio_url) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','/api/voice?key=00000000-0000-4000-8000-000000000004%2F00000000-0000-4000-8000-000000000001%2F00000000-0000-4000-8000-000000000005');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.messages where conversation_id = '00000000-0000-4000-8000-000000000004') <> 2 then raise exception 'Therapist cannot read client messages'; end if;
  begin
    update public.practitioners set approved = true where id = -1;
    raise exception 'FAIL: user can approve themselves';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
do $$ begin
  if exists(select 1 from public.messages where conversation_id = '00000000-0000-4000-8000-000000000004') then raise exception 'FAIL: unrelated user can read messages'; end if;
  if private.is_participant('00000000-0000-4000-8000-000000000004') then raise exception 'FAIL: unrelated user is a participant'; end if;
  begin
    insert into public.messages(conversation_id,sender_id,text) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','Unauthorized');
    raise exception 'FAIL: unrelated user can write messages';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
