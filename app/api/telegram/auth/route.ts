import { randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/server-auth';
import { apiError } from '@/lib/server-services';
import { telegramSession } from '@/lib/telegram-server';
import { equalSecret, verifyMiniApp } from '@/lib/telegram-validation';
import { approveBrowserLogin } from '@/lib/telegram-browser-login';

const jwks = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'));
export async function GET() {
  const nonce = randomBytes(32).toString('hex');
  const response = NextResponse.json({ nonce }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set('telegram_nonce', nonce, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/api/telegram/auth' });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('Please sign in from the Addis website.');
    const input = await request.json();
    const userId = input.link === true ? (await authorize(request)).user.id : undefined;
    let identity: { id: number; name: string };
    if (typeof input.initData === 'string') {
      // A signed launch may last a full workday when the caller already has a
      // valid Addis session. New anonymous sessions require a recent launch.
      identity = verifyMiniApp(input.initData, process.env.TELEGRAM_BOT_TOKEN || '', Date.now(), userId ? 86400 : 3600);
    } else if (typeof input.idToken === 'string' && input.idToken.length < 16000) {
      const audience = process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_CLIENT_ID;
      if (!audience) throw new Error('Telegram website sign-in is awaiting setup.');
      const { payload } = await jwtVerify(input.idToken, jwks, { issuer: 'https://oauth.telegram.org', audience, algorithms: ['RS256', 'ES256'], maxTokenAge: '5m' });
      if (!equalSecret(String(payload.nonce || ''), request.cookies.get('telegram_nonce')?.value || '') || !Number.isSafeInteger(payload.id) || Number(payload.id) <= 0) throw new Error('Please restart Telegram sign-in.');
      identity = { id: Number(payload.id), name: String(payload.name || 'Telegram member').slice(0, 100) };
    } else throw new Error('Invalid Telegram sign-in.');
    const result = await telegramSession(identity, userId, input.create === true);
    if (input.browserLoginId) await approveBrowserLogin(input.browserLoginId, identity.id);
    const response = NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.delete('telegram_nonce');
    return response;
  } catch (error) { return apiError(error); }
}
