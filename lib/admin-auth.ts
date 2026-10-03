import 'server-only';
import { equalSecret } from './telegram-validation';
import { authorize } from './server-auth';
import { serviceDb } from './server-services';

export async function authorizeAdmin(request: Request) {
  const db = serviceDb();

  // Allow admin passphrase header from web management console
  const adminSecret = process.env.ADMIN_PASSPHRASE || '';
  const providedSecret = request.headers.get('x-admin-passphrase');
  if (providedSecret && adminSecret && process.env.ADMIN_USER_ID && equalSecret(providedSecret, adminSecret)) {
    return { user: { id: process.env.ADMIN_USER_ID }, db };
  }

  // Fallback to Telegram admin account check
  const { user } = await authorize(request);
  const { data, error } = await db.from('telegram_accounts').select('telegram_id').eq('user_id', user.id).maybeSingle();
  const allowed = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (error || !data || !allowed.includes(String(data.telegram_id))) {
    throw new Error('Administrator access required. Sign in with authorized admin credentials.');
  }
  return { user, db };
}
