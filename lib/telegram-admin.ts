import { telegram } from './telegram-server';
import { serviceDb } from './server-services';

export async function notifyAdmins(text: string, markup?: unknown) {
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!adminIds.length) return;
  for (const id of adminIds) {
    try {
      await telegram('sendMessage', { 
        chat_id: id, 
        text, 
        parse_mode: 'HTML',
        ...(markup ? { reply_markup: markup } : {}) 
      });
    } catch (err) {
      console.error(`Failed to notify admin ${id}:`, err);
    }
  }
}

export async function notifyUser(userId: string, text: string) {
  const db = serviceDb();
  const { data: account } = await db.from('telegram_accounts').select('chat_id').eq('user_id', userId).maybeSingle();
  if (account && account.chat_id) {
    try {
      await telegram('sendMessage', { 
        chat_id: account.chat_id, 
        text, 
        parse_mode: 'HTML'
      });
    } catch (err) {
      console.error(`Failed to notify user via telegram ${userId}:`, err);
    }
  }
}
