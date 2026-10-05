import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
function moduleAt(path, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error('Unexpected dependency: ' + name);
  }, loaded, loaded.exports, ...Object.values(globals));
  return loaded.exports;
}

function database(tables = {}) {
  const queries = [];
  return { tables, queries, async rpc() { return { data: true, error: null }; }, from(table) {
    let mode = 'select', value, single = false;
    const filters = [], entry = { table, filters };
    const query = {
      select(columns) { entry.columns = columns; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      is(key, value) { filters.push([key, value]); return query; },
      gt(key, value) { filters.push([key, value, '>']); return query; },
      order() { return query; }, range() { return query; }, limit() { return query; },
      maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      insert(row) { mode = 'insert'; value = row; return query; }, update(row) { mode = 'update'; value = row; return query; },
      then(resolve) {
        queries.push(entry);
        const matches = row => filters.every(([k, v, op]) => op === '>' ? row[k] > v : (row[k] ?? null) === v);
        const rows = tables[table] ||= [];
        if (mode === 'insert') rows.push({ ...value });
        const result = rows.filter(matches);
        if (mode === 'update') result.forEach(row => Object.assign(row, value));
        resolve({ data: single ? result[0] ? { ...result[0] } : null : result.map(row => ({ ...row })), error: null });
      }
    };
    return query;
  } };
}

test('Telegram website approval is browser-bound, expires, consumes once and never stores session tokens', async () => {
  const db = database(), crypto = { createHash };
  const helper = moduleAt('lib/telegram-browser-login.ts', { 'server-only': {}, 'node:crypto': crypto, './server-services': { serviceDb: () => db } });
  const sessions = [];
  let caller = 'account-a';
  const route = moduleAt('app/api/telegram/login/route.ts', {
    'node:crypto': require('node:crypto'), 'next/server': require('next/server'),
    '@/lib/server-auth': { authorize: async () => ({ user: { id: caller } }) },
    '@/lib/server-services': { serviceDb: () => db, apiError: error => Response.json({ error: error.message }, { status: 400 }) },
    '@/lib/telegram-server': { telegramSession: async (identity, link) => { sessions.push({ identity, link }); return { session: { access_token: 'test-access', refresh_token: 'test-refresh' } }; } },
    '@/lib/telegram-browser-login': helper
  });
  const { NextRequest } = require('next/server');
  const prior = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = 'test_bot';
  const begin = link => route.POST(new NextRequest('https://example.com/api/telegram/login', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ link }) }));
  const poll = (id, cookie = '') => route.POST(new NextRequest('https://example.com/api/telegram/login', {
    method: 'POST',
    headers: { Origin: 'https://example.com', 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ checkId: id })
  }));
  try {
    const start = await begin(false), { id, url } = await start.json();
    const cookie = start.headers.get('set-cookie').split(';')[0];
    assert.equal(url, 'https://t.me/test_bot?start=login_' + id);
    assert.equal((await poll(id)).status, 400);
    assert.deepEqual(await (await poll(id, cookie)).json(), { pending: true });
    await helper.approveBrowserLogin(id, 123456);
    const completed = await poll(id, cookie);
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).session.access_token, 'test-access');
    assert.equal((await poll(id, cookie)).status, 400);
    assert.equal(sessions.length, 1);
    assert.equal(JSON.stringify(db.tables).includes('test-access'), false);
    assert.equal(JSON.stringify(db.tables).includes(cookie.split('=')[1]), false);
    await assert.rejects(helper.approveBrowserLogin(id, 987654), /expired|used/);
    const next = await begin(true), second = await next.json(), nextCookie = next.headers.get('set-cookie').split(';')[0];
    await helper.approveBrowserLogin(second.id, 123456);
    caller = 'account-b';
    assert.equal((await poll(second.id, nextCookie)).status, 400);
    assert.equal(db.tables.telegram_browser_logins[1].consumed_at, undefined);
    caller = 'account-a';
    assert.equal((await poll(second.id, nextCookie)).status, 200);
    assert.equal(sessions[1].link, 'account-a');
    const expired = randomUUID();
    db.tables.telegram_browser_logins.push({ id: expired, expires_at: '2000-01-01T00:00:00Z' });
    await assert.rejects(helper.approveBrowserLogin(expired, 123456), /expired/);
  } finally { if (prior === undefined) delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME; else process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = prior; }
});

function hooks() {
  const values = [], effects = []; let cursor = 0, pending = [];
  const react = {
    useState(initial) { const id = cursor++; if (!(id in values)) values[id] = initial; return [values[id], value => { values[id] = typeof value === 'function' ? value(values[id]) : value; }]; },
    useRef(initial) { return values[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) { const id = cursor++; const prior = values[id]; if (!prior || deps.some((v, i) => v !== prior.deps[i])) values[id] = { fn, deps }; return values[id].fn; },
    useEffect(fn, deps) { const id = cursor++, prior = effects[id]; if (!prior || deps.some((v, i) => v !== prior.deps[i])) pending.push(() => { prior?.cleanup?.(); effects[id] = { deps, cleanup: fn() }; }); }
  };
  return { react, render(fn) { cursor = 0; return fn(); }, flush() { const jobs = pending; pending = []; jobs.forEach(fn => fn()); }, close() { effects.forEach(effect => effect?.cleanup?.()); } };
}

test('live messages update locally, hidden tabs release subscriptions, and returning resynchronizes missed messages', async () => {
  const h = hooks(), channels = [], removed = [], timers = new Map(); let seq = 0, directoryGets = 0, visible = true;
  const thread = { id: 'conversation', client_id: 'client', therapist_id: 1 };
  const row = { id: 'message-1', conversation_id: thread.id, sender_id: 'therapist', text: 'Hello', created_at: '2026-10-04T20:00:00Z' };
  const practitioner = { id: 1, approved: true, user_id: 'therapist', profile: { name: 'Practitioner' }, settings: { online: 100, photo: 'https://example.com/photo.jpg' }, last_seen_at: '2026-10-04T20:00:00Z' };
  const db = database({ conversations: [thread], messages: [row], conversation_reads: [{ user_id: 'client', conversation_id: thread.id, read_at: row.created_at }] });
  db.auth = { onAuthStateChange(fn) { fn('SIGNED_IN', { user: { id: 'client' } }); return { data: { subscription: { unsubscribe() {} } } }; } };
  db.channel = name => { const channel = { name, handlers: [], on(type, filter, fn) { channel.handlers.push({ type, filter, fn }); return channel; }, subscribe(fn) { fn?.('SUBSCRIBED'); return channel; } }; channels.push(channel); return channel; };
  db.removeChannel = async channel => { removed.push(channel.name); };
  const browser = new EventTarget(), document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const timer = fn => { const id = ++seq; timers.set(id, fn); return id; };
  const lifecycle = moduleAt('lib/realtime-lifecycle.ts', {});
  const { useMessaging } = moduleAt('lib/useMessaging.ts', { react: h.react, './supabase': { getSupabase: () => db }, './voice': {}, './usePageVisible': { usePageVisible: () => visible }, './realtime-lifecycle': lifecycle }, {
    window: browser, document, fetch: async () => { directoryGets++; return Response.json([practitioner]); },
    setTimeout: timer, clearTimeout: id => timers.delete(id), setInterval: timer, clearInterval: id => timers.delete(id)
  });
  try {
    h.render(useMessaging); h.flush(); h.render(useMessaging); h.flush();
    await new Promise(resolve => setImmediate(resolve));
    let state = h.render(useMessaging);
    assert.equal(state.messages.length, 1);
    assert.equal(db.queries.find(q => q.table === 'conversation_reads').filters.some(([key, value]) => key === 'user_id' && value === 'client'), true);
    const count = db.queries.filter(q => q.table === 'messages').length;
    const receive = channels.find(c => c.name === 'messages:client').handlers.find(h => h.filter.table === 'messages').fn;
    const next = { ...row, id: 'message-2', text: 'Second message', created_at: '2026-10-04T20:01:00Z' };
    receive({ eventType: 'INSERT', new: next }); receive({ eventType: 'INSERT', new: next });
    receive({ eventType: 'UPDATE', new: { ...next, text: 'Edited message', edited_at: '2026-10-04T20:02:00Z' } });
    state = h.render(useMessaging);
    assert.equal(state.messages.length, 2);
    assert.equal(state.messages[1].text, 'Edited message');
    assert.equal(db.queries.filter(q => q.table === 'messages').length, count);
    const before = directoryGets;
    channels.find(c => c.name === 'directory:client').handlers[0].fn({ eventType: 'UPDATE', new: { ...practitioner, last_seen_at: '2026-10-04T20:03:00Z' } });
    state = h.render(useMessaging);
    assert.equal(state.cloudSettings[1].lastSeenAt, '2026-10-04T20:03:00Z');
    assert.equal(directoryGets, before);
    receive({ eventType: 'DELETE', old: { id: next.id } });
    assert.equal(h.render(useMessaging).messages.length, 1);
    visible = false; document.visibilityState = 'hidden';
    h.render(useMessaging); h.flush();
    assert.ok(removed.includes('messages:client') && removed.includes('directory:client'));
    const pausedQueries = db.queries.length;
    for (const fn of [...timers.values()]) fn();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(db.queries.length, pausedQueries);
    db.tables.messages.push(next);
    visible = true; document.visibilityState = 'visible';
    h.render(useMessaging); h.flush();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.render(useMessaging).messages.length, 2);
    assert.equal(channels.filter(c => c.name === 'messages:client').length, 2);
  } finally { h.close(); }
});

test('short visibility changes keep subscriptions and abandoned tabs pause after thirty seconds', () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const timers = new Map(); let seq = 0, subscribe, snapshot, updates = 0;
  const { usePageVisible } = moduleAt('lib/usePageVisible.ts', { react: { useSyncExternalStore(sub, get, server) { subscribe = sub; snapshot = get; assert.equal(server(), true); return get(); } } }, {
    document, setTimeout: fn => { const id = ++seq; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id)
  });
  assert.equal(usePageVisible(), true);
  const close = subscribe(() => updates++);
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(snapshot(), true);
  document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(timers.size, 0);
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  [...timers.values()][0]();
  assert.equal(snapshot(), false);
  document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(snapshot(), true);
  assert.equal(updates, 2);
  close();
});

test('rapid channel rejoin waits for the prior asynchronous leave and cancelled joins stay cancelled', async () => {
  const { subscribePrivate } = moduleAt('lib/realtime-lifecycle.ts', {});
  let count = 0, leave;
  const db = { channel: () => { count++; return {}; }, removeChannel: () => new Promise(resolve => { leave = resolve; }) };
  const close = subscribePrivate(db, 'same-topic', channel => channel);
  close();
  const cancel = subscribePrivate(db, 'same-topic', channel => channel);
  assert.equal(count, 1);
  cancel(); leave(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(count, 1);
  subscribePrivate(db, 'same-topic', channel => channel);
  assert.equal(count, 2);
});

test('idle notification checks slow down while new messages, near reminders and retries restore minute delivery', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema private;
      create table public.notification_jobs(id bigint, delivered_at timestamptz, attempts integer default 0, due_at timestamptz, lease_until timestamptz);`);
    await db.exec(readFileSync(new URL('./cron-fixture.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/20261004234822_idle_usage_reduction.sql', import.meta.url), 'utf8'));
    const schedule = async () => (await db.query('select schedule from cron.job where jobid=1')).rows[0].schedule;
    assert.equal(await schedule(), '*/10 * * * *');
    await db.exec("insert into public.notification_jobs(id,due_at) values(1,now()+interval '20 seconds')");
    assert.equal(await schedule(), '* * * * *');
    await db.exec("update public.notification_jobs set due_at=now()+interval '1 day'");
    assert.equal(await schedule(), '*/10 * * * *');
    await db.exec("alter table public.notification_jobs disable trigger notification_schedule_changed; update public.notification_jobs set due_at=now()+interval '14 minutes'; alter table public.notification_jobs enable trigger notification_schedule_changed; select private.wake_notifications()");
    assert.equal(await schedule(), '* * * * *');
    await db.exec("update public.notification_jobs set lease_until=now()+interval '1 hour'");
    assert.equal(await schedule(), '*/10 * * * *');
    await db.exec("update public.notification_jobs set lease_until=now()+interval '5 minutes'");
    assert.equal(await schedule(), '* * * * *');
    await db.exec('update public.notification_jobs set attempts=8');
    assert.equal(await schedule(), '*/10 * * * *');
    await db.exec('update public.notification_jobs set attempts=1');
    assert.equal(await schedule(), '* * * * *');
    await db.exec('update public.notification_jobs set delivered_at=now()');
    assert.equal(await schedule(), '*/10 * * * *');
    assert.equal((await db.query("select has_function_privilege('authenticated','private.tune_notification_schedule()','execute') as allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});
