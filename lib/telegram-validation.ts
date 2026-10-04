import { createHmac, timingSafeEqual } from 'node:crypto';

export function equalSecret(a: string, b: string) {
  return !!a && !!b && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyMiniApp(data: string, token: string, now = Date.now(), maxAge = 3600) {
  if (!token || !data || data.length > 16000) throw new Error('Open the app again from Telegram.');
  const params = new URLSearchParams(data);
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new Error('Invalid Telegram sign-in.');
  const hash = params.get('hash') || '';
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', key).update(check).digest('hex');
  const authDate = Number(params.get('auth_date'));
  const age = now / 1000 - authDate;
  if (!equalSecret(hash, expected) || !Number.isSafeInteger(authDate) || authDate <= 0 || age < -30 || age > maxAge) throw new Error('Telegram sign-in expired. Close and reopen the mini app from the bot.');
  const user = JSON.parse(params.get('user') || '{}');
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || user.is_bot) throw new Error('Invalid Telegram account.');
  return { id: user.id as number, name: String(user.first_name || 'Telegram member').slice(0, 100) };
}
