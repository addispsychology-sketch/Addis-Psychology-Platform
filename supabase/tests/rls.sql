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
insert into public.terms_acceptances(user_id, audience, version) values
('00000000-0000-4000-8000-000000000001', 'client', '2026-10-03.2');
insert into public.payment_requests(user_id, kind, principal_cents, fee_cents, method, reference, status) values
('00000000-0000-4000-8000-000000000001', 'combined', 100, 5, 'telebirr', 'RLS-TEST-00001', 'approved');
insert into public.credit_lots(user_id, payment_id, texts, voice_seconds, initial_texts, initial_voice_seconds, principal_cents)
select user_id, id, 100, 3600, 100, 3600, 100 from public.payment_requests where reference = 'RLS-TEST-00001';
-- Comprehensive packages must be purchasable and grant the advertised credits.
insert into public.payment_requests(id,user_id,kind,principal_cents,fee_cents,method,reference) values
('00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000003','comprehensive',48000,2400,'cbe','COMPREHENSIVE-TEST');
select public.review_payment('00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000002',true);
do $$ begin
 if not exists(select 1 from public.credit_lots where payment_id='00000000-0000-4000-8000-000000000099' and texts=250 and voice_seconds=900) then raise exception 'Comprehensive credits incorrect'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
insert into public.messages(conversation_id, sender_id, text) values
('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'RLS test');
update public.messages set text='RLS edited' where text='RLS test';
do $$ begin
 if not exists(select 1 from public.messages where text='RLS edited' and edited_at is not null) then raise exception 'Own message edit failed'; end if;
 if (select texts from public.credit_lots where user_id='00000000-0000-4000-8000-000000000001')<>99 then raise exception 'Edit charged another credit'; end if;
 begin
  update public.messages set sender_id='00000000-0000-4000-8000-000000000002' where text='RLS edited';
  raise exception 'FAIL: edit can change sender';
 exception when insufficient_privilege then null; end;
 begin
  update public.messages set edited_at=now()-interval '1 day' where text='RLS edited';
  raise exception 'FAIL: edit can forge timestamp';
 exception when insufficient_privilege then null; end;
 begin
  update public.messages set text='  ' where text='RLS edited';
  raise exception 'FAIL: empty edit accepted';
 exception when insufficient_privilege or check_violation then null; end;
end $$;
do $$ begin
  if (select count(*) from public.messages where conversation_id = '00000000-0000-4000-8000-000000000004') <> 1 then raise exception 'Client cannot read own conversation'; end if;
  begin
    insert into public.messages(conversation_id,sender_id,text) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','Forged sender');
    raise exception 'FAIL: forged sender accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.messages(conversation_id,sender_id,audio_url,duration_seconds) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','/api/voice?key=00000000-0000-4000-8000-000000000004%2F00000000-0000-4000-8000-000000000003%2F00000000-0000-4000-8000-000000000005',30);
    raise exception 'FAIL: another user audio path accepted';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.messages(conversation_id,sender_id,audio_url,duration_seconds) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','/api/voice?key=00000000-0000-4000-8000-000000000004%2F00000000-0000-4000-8000-000000000001%2F00000000-0000-4000-8000-000000000005',30);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
update public.messages set text='Forged recipient edit' where text='RLS edited';
do $$ begin
 if not exists(select 1 from public.messages where text='RLS edited') then raise exception 'FAIL: recipient edited sender message'; end if;
end $$;
do $$ begin
  update public.practitioners set settings='{"online":1800,"inperson":2200,"presence":"available"}'::jsonb where id=-1;
  if not exists(select 1 from public.practitioners where id=-1 and settings->>'online'='1800') then raise exception 'Therapist pricing update failed'; end if;
  if public.unread_message_count() <> 2 then raise exception 'Unread count failed for therapist'; end if;
  if (select count(*) from public.messages where conversation_id = '00000000-0000-4000-8000-000000000004') <> 2 then raise exception 'Therapist cannot read client messages'; end if;
  begin
    update public.practitioners set approved = true where id = -1;
    raise exception 'FAIL: user can approve themselves';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
do $$ begin
  if exists(select 1 from public.messages where conversation_id = '00000000-0000-4000-8000-000000000004') then raise exception 'FAIL: unrelated user can read messages'; end if;
  if public.unread_message_count() <> 0 then raise exception 'Unread count leaked unrelated messages'; end if;
  if private.is_participant('00000000-0000-4000-8000-000000000004') then raise exception 'FAIL: unrelated user is a participant'; end if;
  begin
    insert into public.messages(conversation_id,sender_id,text) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','Unauthorized');
    raise exception 'FAIL: unrelated user can write messages';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
