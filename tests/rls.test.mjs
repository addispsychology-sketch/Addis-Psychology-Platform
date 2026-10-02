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
      create schema auth;
      create schema realtime;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table realtime.messages(id bigint, extension text);
      alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
      grant usage on schema public, auth, realtime to anon, authenticated;
      grant select, insert on realtime.messages to authenticated;
      create publication supabase_realtime;
    `);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    }
    const privileges = await db.query("select has_function_privilege('anon', 'private.is_participant(uuid)', 'execute') as anonymous_access");
    assert.equal(privileges.rows[0].anonymous_access, false);
    const policyTests = readFileSync(new URL('../supabase/tests/rls.sql', import.meta.url), 'utf8');
    await db.exec(policyTests.replace('rollback;', () => `
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
      rollback;
    `));
    const result = await db.query('select count(*)::int as count from public.messages');
    assert.equal(result.rows[0].count, 0, 'test fixtures must roll back');
  } finally { await db.close(); }
});
