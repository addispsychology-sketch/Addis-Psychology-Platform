import 'server-only';
import { serviceDb, siteUrl } from './server-services';
import { miniAppLink } from './telegram-links';

export class TelegramRejectedError extends Error {}

export async function telegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram is awaiting setup.');
  // Never surface the response body or URL: they can contain contacts or the bot token.
  const timeout = method === 'sendPhoto' || method === 'sendVideo' ? 45000 : 15000;
  const result = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout) }).catch(() => { throw new Error('Telegram is temporarily unavailable.'); });
  const body = await result.json();
  if (!result.ok || !body.ok) throw new TelegramRejectedError('Telegram could not deliver this request.');
  return body.result;
}

export function miniLink(path: string) {
  return miniAppLink(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, path, process.env.TELEGRAM_MINI_APP_SHORT_NAME);
}

export function mainMiniAppReady(bot: {has_main_web_app?:boolean}) {
  return bot.has_main_web_app===true || /^[a-zA-Z0-9_]{1,64}$/.test(process.env.TELEGRAM_MINI_APP_SHORT_NAME || '');
}

export async function requireDirectMiniApp() {
  if(!mainMiniAppReady(await telegram('getMe',{})))throw new Error('Enable this bot’s Main Mini App in BotFather before publishing direct app buttons.');
}

export function privateAppButton(text: string, path: string) {
  return { text, web_app: { url: siteUrl(path) } };
}

export async function telegramSession(identity: { id: number; name: string }, linkUserId?: string, create = false) {
  const db = serviceDb();
  const { data: mapping, error: lookupError } = await db.from('telegram_accounts').select('user_id').eq('telegram_id', identity.id).maybeSingle();
  if (lookupError) throw new Error('Telegram sign-in is awaiting database setup.');
  if (linkUserId) {
    if (mapping && mapping.user_id !== linkUserId) throw new Error('This Telegram account is already linked to another Addis account. Sign in to that account instead.');
    const { data: own } = await db.from('telegram_accounts').select('telegram_id').eq('user_id', linkUserId).maybeSingle();
    if (own && Number(own.telegram_id) !== identity.id) throw new Error('This Addis account already has a Telegram account connected.');
    const { error } = await db.from('telegram_accounts').upsert({ user_id: linkUserId, telegram_id: identity.id }, { onConflict: 'user_id' });
    if (error) throw new Error('This Telegram account could not be linked.');
    return { linked: true };
  }
  let userId = mapping?.user_id;
  if (!userId) {
    if (!create) return { needsAccount: true };
    const email = `telegram.${identity.id}@telegram.addis.invalid`;
    const created = await db.auth.admin.createUser({ email, email_confirm: true, app_metadata: { telegram_id: identity.id }, user_metadata: { full_name: identity.name } });
    if (created.error || !created.data.user) throw new Error('Unable to create your Telegram account. If you already have an Addis account, sign in and connect Telegram from Account.');
    userId = created.data.user.id;
    const { error } = await db.from('telegram_accounts').insert({ user_id: userId, telegram_id: identity.id });
    if (error) { await db.auth.admin.deleteUser(userId); throw new Error('Please reopen Telegram and try again.'); }
  }
  const { data: existing } = await db.auth.admin.getUserById(userId);
  if (!existing.user?.email) throw new Error('Please use your phone and password to sign in.');
  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: 'magiclink', email: existing.user.email });
  if (linkError || link.user.id !== userId || !link.properties.hashed_token) throw new Error('Unable to sign in. Please try again.');
  const { data, error } = await db.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error || !data.session || data.user?.id !== userId) throw new Error('Unable to sign in. Please try again.');
  return { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
}
