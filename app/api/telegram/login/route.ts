import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/server-auth';
import { apiError, serviceDb } from '@/lib/server-services';
import { telegramSession } from '@/lib/telegram-server';
import { browserLoginId, loginCookieName, loginSecretHash } from '@/lib/telegram-browser-login';

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('Please sign in from the Addis website.');
    const input = await request.json();
    const linkUserId = input.link === true ? (await authorize(request)).user.id : null;
    const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!bot || !/^[a-zA-Z0-9_]+$/.test(bot)) throw new Error('Telegram is awaiting setup.');
    const db = serviceDb();
    const source = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown';
    const { data: allowed, error: limitError } = await db.rpc('claim_phone_login', { key_value: loginSecretHash('telegram-browser:' + source), attempt_limit: 20 });
    if (limitError || !allowed) throw new Error('Too many sign-in attempts. Please try again in fifteen minutes.');
    const id = randomUUID(), secret = randomBytes(32).toString('hex');
    const { error } = await db.from('telegram_browser_logins').insert({ id, secret_hash: loginSecretHash(secret), link_user_id: linkUserId, expires_at: new Date(Date.now() + 300000).toISOString() });
    if (error) throw new Error('Telegram sign-in is temporarily unavailable.');
    const response = NextResponse.json({ id, url: `https://t.me/${bot}?start=login_${id}` }, { headers: noStore });
    response.cookies.set(loginCookieName(id), secret, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 300, path: '/api/telegram/login' });
    return response;
  } catch (error) { return apiError(error); }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!browserLoginId(id)) throw new Error('Invalid sign-in request.');
    const secret = request.cookies.get(loginCookieName(id))?.value;
    if (!secret) throw new Error('This sign-in request has expired. Please start again.');
    const db = serviceDb();
    const { data: pending, error } = await db.from('telegram_browser_logins').select('telegram_id,link_user_id')
      .eq('id', id).eq('secret_hash', loginSecretHash(secret)).is('consumed_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error || !pending) throw new Error('This sign-in request has expired. Please start again.');
    if (!pending.telegram_id) return NextResponse.json({ pending: true }, { headers: noStore });
    if (pending.link_user_id && (await authorize(request)).user.id !== pending.link_user_id) throw new Error('Sign in to the original Addis account before connecting Telegram.');
    // Atomically consume: concurrent polls cannot mint multiple sessions.
    const { data: consumed, error: consumeError } = await db.from('telegram_browser_logins').update({ consumed_at: new Date().toISOString() })
      .eq('id', id).eq('secret_hash', loginSecretHash(secret)).is('consumed_at', null).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
    if (consumeError || !consumed) throw new Error('This sign-in request was already used.');
    const result = await telegramSession({ id: Number(pending.telegram_id), name: 'Telegram member' }, pending.link_user_id || undefined, true);
    const response = NextResponse.json(result, { headers: noStore });
    response.cookies.set(loginCookieName(id), '', { maxAge: 0, path: '/api/telegram/login' });
    return response;
  } catch (error) { return apiError(error); }
}
