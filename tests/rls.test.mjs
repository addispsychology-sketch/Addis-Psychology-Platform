import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('migration enforces participant access, sender identity, and approval privileges', async () => {
  const db = new PGlite();
  try {
    // Supabase-owned schemas/functions are represented locally; policy SQL is unchanged.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create schema realtime;
      create schema storage;
      create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select, insert, update, delete on storage.objects to authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table realtime.messages(id bigint, extension text);
      alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
      grant usage on schema public, auth, realtime to anon, authenticated, service_role;
      grant select, insert on realtime.messages to authenticated;
      create publication supabase_realtime;
    `);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    }
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.claim_phone_login(text,integer)', 'execute') as allowed")).rows[0].allowed, false);
    await db.exec('set role service_role');
    for (let attempt = 1; attempt <= 10; attempt++) {
      const limited = await db.query("select public.claim_phone_login(repeat('a',64),8) as allowed");
      assert.equal(limited.rows[0].allowed, attempt <= 8);
    }
    await db.exec("update public.auth_attempt_windows set started_at = now() - interval '16 minutes'");
    assert.equal((await db.query("select public.claim_phone_login(repeat('a',64),8) as allowed")).rows[0].allowed, true);
    await db.exec('reset role');
    const privileges = await db.query("select has_function_privilege('anon', 'private.is_participant(uuid)', 'execute') as anonymous_access");
    assert.equal(privileges.rows[0].anonymous_access, false);
    const policyTests = readFileSync(new URL('../supabase/tests/rls.sql', import.meta.url), 'utf8');
    await db.exec(policyTests.replace('rollback;', () => `
      reset role;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
      insert into storage.objects(bucket_id,name) values ('voice-notes','00000000-0000-4000-8000-000000000004/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000005');
      do $$ begin
        if exists(select 1 from storage.objects) then raise exception 'FAIL: unpublished upload readable'; end if;
        begin
          insert into storage.objects(bucket_id,name) values ('voice-notes','00000000-0000-4000-8000-000000000004/00000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000005');
          raise exception 'FAIL: forged upload owner accepted';
        exception when insufficient_privilege then null; end;
      end $$;
      insert into public.messages(conversation_id,sender_id,audio_url) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','/api/voice?key=00000000-0000-4000-8000-000000000004%2F00000000-0000-4000-8000-000000000001%2F00000000-0000-4000-8000-000000000005&storage=supabase');
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
      do $$ begin
        if not exists(select 1 from storage.objects) then raise exception 'Recipient cannot read voice'; end if;
        delete from storage.objects;
        if not exists(select 1 from storage.objects) then raise exception 'FAIL: recipient deleted voice'; end if;
      end $$;
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
      do $$ begin
        if exists(select 1 from storage.objects) then raise exception 'FAIL: unrelated user can read voice'; end if;
        begin
          insert into storage.objects(bucket_id,name) values ('voice-notes','00000000-0000-4000-8000-000000000004/00000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000005');
          raise exception 'FAIL: unrelated user can upload voice';
        exception when insufficient_privilege then null; end;
      end $$;
      reset role;
      insert into realtime.messages(id, extension) values (1, 'broadcast');
      set local role authenticated;
      select set_config('realtime.topic','call:00000000-0000-4000-8000-000000000004',true);
      do $$ begin
        if exists(select 1 from realtime.messages) then raise exception 'FAIL: unrelated user can receive signaling'; end if;
        begin
          insert into realtime.messages(id,extension) values (2,'broadcast');
          raise exception 'FAIL: unrelated user can send signaling';
        exception when insufficient_privilege then null; end;
      end $$;
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
      do $$ begin
        if not exists(select 1 from realtime.messages) then raise exception 'Participant cannot receive signaling'; end if;
      end $$;
      insert into realtime.messages(id,extension) values (2,'broadcast');
      select set_config('realtime.topic','messages:00000000-0000-4000-8000-000000000001',true);
      do $$ begin
        if not exists(select 1 from realtime.messages) then raise exception 'User cannot join own message topic'; end if;
      end $$;
      select set_config('realtime.topic','messages:00000000-0000-4000-8000-000000000003',true);
      do $$ begin
        if exists(select 1 from realtime.messages) then raise exception 'FAIL: user can join another message topic'; end if;
      end $$;
      reset role;
      insert into public.telegram_accounts(user_id,telegram_id,chat_id) values ('00000000-0000-4000-8000-000000000001',100001,100001);
      insert into public.appointments(id,client_id,therapist_id,starts_at,medium,price,client_name,phone,consent_at)
        select '00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',id,now()+interval '3 days','online',1200,'Test client','+251911111111',now() from public.practitioners where user_id='00000000-0000-4000-8000-000000000002';
      do $$ begin
        if (select count(*) from public.notification_jobs where kind='appointment') <> 4 then raise exception 'Booking must queue both recipients and channels'; end if;
        if not exists(select 1 from public.notification_jobs where kind='message' and recipient='00000000-0000-4000-8000-000000000002') then raise exception 'Message notification sent to wrong user'; end if;
        if exists(select 1 from public.notification_jobs where summary like '%private test%') then raise exception 'Message contents leaked into alert'; end if;
      end $$;
      update public.appointments set status='confirmed' where id='00000000-0000-4000-8000-000000000010';
      do $$ begin
        if (select count(*) from public.notification_jobs where kind='reminder') <> 8 then raise exception 'Both reminder windows must be queued for both users and channels'; end if;
      end $$;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
      do $$ begin
        if (select count(*) from public.appointments) <> 1 then raise exception 'Client cannot read own appointment'; end if;
        if (select count(*) from public.telegram_accounts) <> 1 then raise exception 'Client cannot read own connection'; end if;
        begin
          update public.appointments set price=0;
          raise exception 'FAIL: client forged booking price';
        exception when insufficient_privilege then null; end;
        begin
          update public.telegram_accounts set telegram_id=123;
          raise exception 'FAIL: client forged Telegram identity';
        exception when insufficient_privilege then null; end;
        begin
          perform * from public.claim_notification_jobs();
          raise exception 'FAIL: client claimed delivery jobs';
        exception when insufficient_privilege then null; end;
        begin
          perform * from public.notification_jobs;
          raise exception 'FAIL: client read delivery queue';
        exception when insufficient_privilege then null; end;
      end $$;
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
      do $$ begin
        if (select count(*) from public.appointments) <> 1 then raise exception 'Therapist cannot read session contact details'; end if;
        if exists(select 1 from public.telegram_accounts) then raise exception 'FAIL: therapist read client Telegram identity'; end if;
      end $$;
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
      do $$ begin
        if exists(select 1 from public.appointments) then raise exception 'FAIL: unrelated user read appointment contact details'; end if;
      end $$;
      reset role;
      set local role service_role;
      do $$ declare first_count integer; second_count integer; begin
        select count(*) into first_count from public.claim_notification_jobs();
        select count(*) into second_count from public.claim_notification_jobs();
        if first_count = 0 or second_count > 0 then raise exception 'Job lease failed to prevent duplicate claims'; end if;
      end $$;
      rollback;
    `));
    const result = await db.query('select count(*)::int as count from public.messages');
    assert.equal(result.rows[0].count, 0, 'test fixtures must roll back');
  } finally { await db.close(); }
});
