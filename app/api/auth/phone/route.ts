import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/booking-validation';
import { serviceDb, siteUrl } from '@/lib/server-services';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const invalid = () => Response.json({ error: 'Unable to sign in. Check your verified phone number and password.' }, { status: 401, headers });
  try {
    if (request.headers.get('origin') !== new URL(siteUrl()).origin) return invalid();
    const raw = await request.text();
    if (raw.length > 4096) return invalid();
    const input = JSON.parse(raw);
    const phone = normalizePhone(input.phone);
    if (typeof input.password !== 'string' || input.password.length > 1024 || !input.password) return invalid();
    const secret = process.env.NOTIFICATION_JOB_SECRET;
    if (!secret) throw new Error('Configuration missing');
    const db = serviceDb();
    const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const address = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limits = await Promise.all([
      db.rpc('claim_phone_login', { key_value: hash('phone:' + phone), attempt_limit: 8 }),
      db.rpc('claim_phone_login', { key_value: hash('ip:' + address), attempt_limit: 40 }),
    ]);
    if (limits.some(result => result.error)) throw new Error('Rate limit unavailable');
    if (limits.some(result => !result.data)) return Response.json({ error: 'Too many attempts. Please try again in 15 minutes.' }, { status: 429, headers });
    const { data: account, error } = await db.from('telegram_accounts').select('user_id').eq('verified_phone', phone).maybeSingle();
    if (error) throw error;
    if (!account) return invalid();
    const { data } = await db.auth.admin.getUserById(account.user_id);
    if (!data.user?.email) return invalid();
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await auth.auth.signInWithPassword({ email: data.user.email, password: input.password });
    if (signed.error || signed.data.user?.id !== account.user_id || !signed.data.session) return invalid();
    return Response.json({ access_token: signed.data.session.access_token, refresh_token: signed.data.session.refresh_token }, { headers });
  } catch {
    return invalid();
  }
}
