import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, configureCloud } from '../scripts/configure-cloud.mjs';

const env = {
  VOICE_STORAGE: 'r2',
  VERCEL_TOKEN: 'test-token', VERCEL_ORG_ID: 'test-org', VERCEL_PROJECT_ID: 'test-project',
  SUPABASE_ACCESS_TOKEN: 'test-token', SUPABASE_DB_PASSWORD: 'test-password', SUPABASE_PROJECT_ID: 'abcdefghijklmnopqrst',
  CLOUDFLARE_API_TOKEN: 'test-token', R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET_NAME: 'test-private-bucket', APP_URL: 'https://app.example.com',
};

test('Supabase voice storage needs no Cloudflare credentials or requests', async () => {
  const settings = { ...env, VOICE_STORAGE: 'supabase', CLOUDFLARE_API_TOKEN: '', R2_ACCOUNT_ID: '', R2_BUCKET_NAME: '' };
  const cloud = fakeCloud();
  await configureCloud(settings, async (url, options) => {
    assert.equal(new URL(url).hostname, 'api.supabase.com');
    return cloud.request(url, options);
  });
  assert.equal(cloud.state().auth.site_url, 'http://localhost:3000', 'preserve the older application default URL');
});

function fakeCloud({ publicBucket = false, exists = false, failure = false } = {}) {
  let auth = { site_url: 'http://localhost:3000', uri_allow_list: 'http://localhost:3000/account', password_min_length: 16, smtp_host: 'keep-existing-mail.example' };
  let realtime = { private_only: false };
  let rules = [{ id: 'other-app', allowed: { origins: ['https://other.example.com'], methods: ['GET'] } }];
  const writes = [];
  const request = async (url, options) => {
    if (failure) return new Response('private-provider-response', { status: 403 });
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : undefined;
    if (options.method !== 'GET') writes.push({ path, body, method: options.method });
    const json = data => Response.json(data);
    if (path.endsWith('/config/auth')) {
      if (body) auth = { ...auth, ...body };
      return json(auth);
    }
    if (path.endsWith('/config/realtime')) {
      if (body) realtime = { ...realtime, ...body };
      return json(realtime);
    }
    if (path.endsWith('/domains/managed')) return json({ success: true, result: { enabled: publicBucket } });
    if (path.endsWith('/domains/custom')) return json({ success: true, result: { domains: [] } });
    if (path.endsWith('/cors')) {
      if (body) rules = body.rules;
      return json({ success: true, result: { rules } });
    }
    if (options.method === 'POST') { exists = true; return json({ success: true }); }
    return exists ? json({ success: true, result: {} }) : new Response('', { status: 404 });
  };
  return { request, writes, state: () => ({ auth, realtime, rules }) };
}

test('missing connections and invalid origins stop before any remote operation', async () => {
  let calls = 0;
  await assert.rejects(configureCloud({}, async () => { calls++; }), /Connections are incomplete/);
  assert.equal(calls, 0);
  for (const origin of ['http://app.example.com', 'https://app.example.com/path', 'https://user:password@app.example.com', 'https://app.example.com/?secret=value']) {
    assert.throws(() => configuration({ ...env, APP_URL: origin }), /HTTPS origin/);
  }
});

test('configuration is repeatable and preserves unrelated redirects, SMTP, password strength, and CORS', async () => {
  const cloud = fakeCloud();
  await configureCloud(env, cloud.request);
  const state = cloud.state();
  assert.equal(state.auth.password_min_length, 16);
  assert.equal(state.auth.smtp_host, 'keep-existing-mail.example');
  assert.equal(state.auth.mailer_autoconfirm, false);
  assert.equal(state.auth.uri_allow_list, 'http://localhost:3000/account,https://app.example.com/account');
  assert.equal(state.realtime.private_only, true);
  assert.equal(state.rules[0].id, 'other-app');
  assert.deepEqual(state.rules[1].allowed.origins, ['https://app.example.com']);
  const writeCount = cloud.writes.length;
  await configureCloud(env, cloud.request);
  assert.equal(cloud.writes.length, writeCount, 'second run must not repeat mutations');
  assert.equal(cloud.writes.filter(w => w.method === 'POST').length, 1, 'create bucket only if absent');
});

test('public voice bucket blocks deployment and does not alter public-access settings', async () => {
  const cloud = fakeCloud({ publicBucket: true, exists: true });
  await assert.rejects(configureCloud(env, cloud.request), /bucket is public/);
  assert.equal(cloud.writes.some(w => w.path.includes('/domains/') || w.path.endsWith('/cors')), false);
});

test('provider errors are surfaced without logging provider response bodies or tokens', async () => {
  const cloud = fakeCloud({ failure: true });
  await assert.rejects(configureCloud(env, cloud.request), error => {
    assert.match(error.message, /HTTP 403/);
    assert.doesNotMatch(error.message, /private-provider-response|test-token/);
    return true;
  });
});
