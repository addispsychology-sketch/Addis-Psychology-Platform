import { pathToFileURL } from 'node:url';

export function configuration(env) {
  const provider = env.VOICE_STORAGE || 'supabase';
  if (!['supabase', 'r2'].includes(provider)) throw new Error('VOICE_STORAGE must be supabase or r2.');
  const names = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_ID', 'APP_URL'];
  if (provider === 'r2') names.push('CLOUDFLARE_API_TOKEN', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME');
  const missing = names.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Connections are incomplete. Missing setting names: ${missing.join(', ')}. See deployment/CONNECTIONS.md.`);
  const origin = new URL(env.APP_URL);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_URL must be an HTTPS origin, without a path, credentials, query, or fragment.');
  if (!/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_ID)) throw new Error('Invalid Supabase project reference.');
  if (provider === 'r2' && !/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID)) throw new Error('Invalid Cloudflare account ID.');
  if (provider === 'r2' && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET_NAME)) throw new Error('Invalid R2 bucket name.');
  return { ...env, VOICE_STORAGE: provider, APP_URL: origin.origin };
}

export async function configureCloud(env, request = fetch) {
  const config = configuration(env); // Validate everything before the first external operation.
  async function api(base, token, path, method = 'GET', body, allow404 = false) {
    const response = await request(base + path, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000),
    });
    if (allow404 && response.status === 404) return null;
    // Do not print provider bodies: they may contain credentials or private configuration.
    if (!response.ok) throw new Error(`Cloud configuration request failed (${method}, HTTP ${response.status}). Check token permissions in deployment/CONNECTIONS.md.`);
    if (response.status === 204) return {};
    const result = await response.json();
    if (result.success === false) throw new Error('Cloudflare rejected a configuration request. Check account permissions.');
    return result;
  }
  const supabase = (path, method, body) => api('https://api.supabase.com', config.SUPABASE_ACCESS_TOKEN, `/v1/projects/${config.SUPABASE_PROJECT_ID}/config/${path}`, method, body);
  const cloudflare = (path, method, body, allow404) => api('https://api.cloudflare.com/client/v4', config.CLOUDFLARE_API_TOKEN, `/accounts/${config.R2_ACCOUNT_ID}/r2/buckets${path}`, method, body, allow404);

  const auth = await supabase('auth');
  const redirects = new Set((auth.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean));
  redirects.add(`${config.APP_URL}/account`);
  const desiredAuth = {
    uri_allow_list: [...redirects].join(','),
    mailer_autoconfirm: false, password_min_length: Math.max(12, auth.password_min_length || 0),
  };
  if (Object.entries(desiredAuth).some(([key, value]) => auth[key] !== value)) await supabase('auth', 'PATCH', desiredAuth);
  const realtime = await supabase('realtime');
  if (!realtime.private_only) await supabase('realtime', 'PATCH', { private_only: true });
  if (config.VOICE_STORAGE === 'supabase') return 'Authentication and private signaling configured. Voice storage uses the private voice-notes bucket created during initial setup.';

  const bucket = `/${config.R2_BUCKET_NAME}`;
  if (!await cloudflare(bucket, 'GET', undefined, true)) await cloudflare('', 'POST', { name: config.R2_BUCKET_NAME });
  const publicAccess = await cloudflare(`${bucket}/domains/managed`);
  if (publicAccess.result?.enabled) throw new Error('The selected R2 bucket is public. Use a dedicated private bucket; deployment has stopped without changing public access.');
  const customDomains = await cloudflare(`${bucket}/domains/custom`);
  if (customDomains.result?.domains?.some(domain => domain.enabled)) throw new Error('The selected R2 bucket has a public custom domain. Choose a dedicated private bucket.');
  const cors = await cloudflare(`${bucket}/cors`, 'GET', undefined, true);
  const rule = {
    id: 'addis-messaging', allowed: { origins: [config.APP_URL], methods: ['PUT', 'GET', 'HEAD'], headers: ['Content-Type', 'Range'] },
    exposeHeaders: ['ETag', 'Content-Length', 'Content-Range'], maxAgeSeconds: 3600,
  };
  const existingRules = cors?.result?.rules || [];
  const managed = existingRules.find(item => item.id === rule.id);
  if (JSON.stringify(managed) !== JSON.stringify(rule)) {
    await cloudflare(`${bucket}/cors`, 'PUT', { rules: [...existingRules.filter(item => item.id !== rule.id), rule] });
  }
  return 'Supabase authentication, private call signaling, and private R2 upload access are configured.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--check')) { configuration(process.env); console.log('All deployment connection settings are present.'); }
    else console.log(await configureCloud(process.env));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
