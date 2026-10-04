import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const origin = process.env.APP_URL;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const check = response => { if (response.error) throw new Error('Database verification failed.'); return response.data; };
const telegramId = Number(process.env.TELEGRAM_ADMIN_IDS.split(',')[0]);
const mapping = check(await db.from('telegram_accounts').select('user_id').eq('telegram_id', telegramId).single());
function launch(age) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), user: JSON.stringify({ id: telegramId, first_name: 'Verification' }), query_id: 'server-verification' });
  const text = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(text).digest('hex'));
  return params.toString();
}
const post = (path, input, token) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(input) });
const sessionUser = session => JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString()).sub;
const results = [];
let requestId;
try {
  const directory = await fetch(origin + '/api/directory');
  assert.equal(directory.status, 200);
  const content = await directory.text();
  assert.ok(Buffer.byteLength(content) < 5000);
  assert.ok(!content.includes('data:image'));
  results.push({ check: 'Small public directory', responseBytes: Buffer.byteLength(content), cache: directory.headers.get('cache-control') });
  const blocked = await post('/api/profile-photo', {});
  assert.equal(blocked.status, 401);
  results.push({ check: 'Unauthenticated photo uploads rejected', status: blocked.status });
  const forged = await post('/api/telegram/auth', { initData: 'auth_date=1&user={}', create: true });
  assert.equal(forged.status, 400);
  results.push({ check: 'Forged Telegram launch rejected', status: forged.status });
  const login = await post('/api/telegram/auth', { initData: launch(600), create: false });
  assert.equal(login.status, 200);
  const signedIn = await login.json();
  assert.equal(sessionUser(signedIn.session), mapping.user_id);
  results.push({ check: 'Ten-minute signed launch signs in to existing linked account', passed: true });
  const linked = await post('/api/telegram/auth', { initData: launch(7200), link: true }, signedIn.session.access_token);
  assert.equal(linked.status, 200);
  assert.equal((await linked.json()).linked, true);
  results.push({ check: 'Existing session connects Telegram after two-hour launch refresh', passed: true });
  const start = await post('/api/telegram/login', { link: false });
  assert.equal(start.status, 200);
  const started = await start.json(); requestId = started.id;
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const poll = cookieValue => fetch(origin + '/api/telegram/login?id=' + requestId, { headers: { Cookie: cookieValue } });
  assert.equal((await poll('')).status, 400);
  assert.equal((await (await poll(cookie)).json()).pending, true);
  const approve = await post('/api/telegram/auth', { initData: launch(600), link: true, browserLoginId: requestId }, signedIn.session.access_token);
  assert.equal(approve.status, 200);
  const consume = await poll(cookie);
  assert.equal(consume.status, 200);
  assert.equal(sessionUser((await consume.json()).session), mapping.user_id);
  assert.equal((await poll(cookie)).status, 400);
  results.push({ check: 'Live browser login requires its cookie, consumes once and returns existing account', passed: true });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  check(await client.auth.setSession(signedIn.session));
  check(await client.rpc('touch_activity'));
  const touched = check(await db.from('user_activity').select('last_seen_at').eq('user_id', mapping.user_id).single());
  check(await client.rpc('touch_activity'));
  const again = check(await db.from('user_activity').select('last_seen_at').eq('user_id', mapping.user_id).single());
  assert.equal(touched?.last_seen_at, again?.last_seen_at);
  results.push({ check: 'Repeated heartbeat does not rewrite activity or trigger another practitioner update', passed: true });
  await client.removeAllChannels();
  console.log(JSON.stringify(results, null, 2));
} finally {
  // Only this script's disposable, consumed sign-in request is removed.
  if (requestId) await db.from('telegram_browser_logins').delete().eq('id', requestId);
}
