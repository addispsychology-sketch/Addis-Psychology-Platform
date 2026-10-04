import 'server-only';
import { createHash } from 'node:crypto';
import { serviceDb } from './server-services';

export const browserLoginId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const loginSecretHash = (secret: string) => createHash('sha256').update(secret).digest('hex');
export const loginCookieName = (id: string) => `telegram_login_${id}`;

export async function approveBrowserLogin(id: string, telegramId: number) {
  if (!browserLoginId(id)) throw new Error('This website sign-in link is invalid.');
  const { data, error } = await serviceDb().from('telegram_browser_logins')
    .update({ telegram_id: telegramId }).eq('id', id).is('telegram_id', null).is('consumed_at', null)
    .gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
  if (error || !data) throw new Error('This website sign-in link has expired or was already used. Start again in your browser.');
}
