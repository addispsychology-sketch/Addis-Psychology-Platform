import 'server-only';
import { randomUUID } from 'node:crypto';
import { serviceDb, siteUrl } from './server-services';
import { miniLink, telegram } from './telegram-server';
import { normalizePhone } from './booking-validation';

type BotMessage = { chat: { id: number; type: string }; from?: { id: number; is_bot?: boolean }; text?: string; caption?: string; photo?: { file_id: string }[]; video?: { file_id: string }; contact?: { user_id?: number; phone_number: string } };
export type BotUpdate = { update_id: number; message?: BotMessage; callback_query?: { id: string; from: { id: number }; data?: string; message?: BotMessage } };
type Draft = { id: string; stage: 'content' | 'ready' | 'publishing'; therapist?: number; button: string; caption?: string; media?: string; mediaType?: 'photo' | 'video' };

const adminIds = () => (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const say = (chat: number, text: string, reply_markup?: unknown) => telegram('sendMessage', { chat_id: chat, text, ...(reply_markup ? { reply_markup } : {}) });

/**
 * Clean, balanced 2-row menu without cluttered vertical buttons
 */
const menu = () => ({
  inline_keyboard: [
    [
      { text: '🌿 Open Addis Platform', web_app: { url: siteUrl('/account') } },
    ],
    [
      { text: '💬 Messages', web_app: { url: siteUrl('/chat') } },
      { text: '📅 Bookings', web_app: { url: siteUrl('/appointments') } },
    ],
    [
      { text: '✨ Packages', web_app: { url: siteUrl('/packages') } },
      { text: '👤 My Account', web_app: { url: siteUrl('/account') } },
    ],
  ],
});

function draftButtons(draft: Draft) {
  if (draft.therapist) return [[{ text: '📅 Book this therapist', url: miniLink(`/schedule/${draft.therapist}`) }, { text: '💬 Chat with therapist', url: miniLink(`/chat?therapist=${draft.therapist}`) }]];
  return [[{ text: '🌿 Open Platform', url: miniLink('/therapists') }]];
}

async function sendPost(chat: number | string, draft: Draft, preview = false) {
  const reply_markup = { inline_keyboard: draftButtons(draft) };
  const caption = `${preview ? 'PREVIEW — only you can see this\n\n' : ''}${draft.caption || ''}`;
  if (draft.media && draft.mediaType) return telegram(draft.mediaType === 'photo' ? 'sendPhoto' : 'sendVideo', { chat_id: chat, [draft.mediaType]: draft.media, caption, reply_markup });
  return telegram('sendMessage', { chat_id: chat, text: caption, reply_markup });
}

export async function handleBotUpdate(update: BotUpdate) {
  const callback = update.callback_query;
  const message = update.message || callback?.message;
  const actor = callback?.from.id || message?.from?.id;
  if (!message || !actor || message.chat.type !== 'private' || message.chat.id !== actor || message.from?.is_bot && !callback) return;
  const chat = message.chat.id;
  const db = serviceDb();
  const text = message.text?.trim() || '';
  const command = text.split(/\s/)[0].split('@')[0].toLowerCase();
  if (callback) await telegram('answerCallbackQuery', { callback_query_id: callback.id });
  if (command === '/id' && !callback) { await say(chat, `Your Telegram ID: ${actor}\n\nUse this number when configuring administrator access.`); return; }
  const { data: account, error: accountError } = await db.from('telegram_accounts').select('user_id').eq('telegram_id', actor).maybeSingle();
  if (accountError) throw new Error('Database unavailable.');
  if (account && !callback) {
    const { error } = await db.from('telegram_accounts').update({ chat_id: chat }).eq('user_id', account.user_id);
    if (error) throw new Error('Database unavailable.');
  }
  const isAdmin = adminIds().includes(String(actor));

  const welcomeText =
    `✨ Addis Psychology — ድጋፍ። በእርስዎ ምርጫ።\n\n` +
    `A dignified, confidential space for mental wellness in Addis Ababa.\n\n` +
    `• Private 1-on-1 text & voice messaging\n` +
    `• Licensed clinical psychologists & therapists\n` +
    `• Transparent Ethiopian Birr pricing & prepaid wallet\n` +
    `• Telebirr (0990171738) & CBE verified payments\n\n` +
    `Tap "Open Addis Platform" below to get started, or select a section:` +
    (isAdmin ? '\n\n🛡️ Admin tools: /admin' : '');

  if ((command === '/start' || command === '/help') && !callback) {
    await say(chat, welcomeText, menu());
    return;
  }
  if (command === '/stop' && account && !callback) {
    await db.from('account_preferences').upsert({ user_id: account.user_id, telegram_notifications: false });
    await say(chat, '🔕 Telegram notifications paused. You can turn them back on in your Account settings.', menu()); return;
  }
  if (message.contact && !callback) {
    if (!account) { await say(chat, 'Please open the platform below first and connect your account, then use /phone again.', menu()); return; }
    if (message.contact.user_id !== actor) { await say(chat, 'Please share your own phone number using the button below.'); return; }
    const phone = normalizePhone('+' + message.contact.phone_number.replace(/^\+/, ''));
    const { error } = await db.from('telegram_accounts').update({ verified_phone: phone }).eq('user_id', account.user_id);
    await say(chat, error ? 'This phone number could not be connected. It may belong to another Addis account.' : '✓ Phone number verified! You can now sign in on the website using this number and your password.', { remove_keyboard: true });
    return;
  }
  if (command === '/phone' && !callback) {
    await say(chat, 'Share your phone number to enable phone-and-password sign in. Your number stays strictly private.', { keyboard: [[{ text: '📱 Share my phone', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }); return;
  }
  if (isAdmin && !callback && (command === '/admin' || command === '/announce' || command === '/promote')) {
    if (command === '/admin') {
      await say(chat, '📣 Publishing Studio\n\nCreate announcements or promote a verified practitioner.\n\nTo promote a therapist, send /promote followed by their directory ID.', { inline_keyboard: [[{ text: '✍️ New Announcement', callback_data: 'draft:new' }]] }); return;
    }
    const therapist = command === '/promote' ? Number(text.split(/\s+/)[1]) : undefined;
    if (command === '/promote') {
      const { data: p } = await db.from('practitioners').select('id').eq('id', therapist).eq('approved', true).maybeSingle();
      if (!p) { await say(chat, 'Send /promote followed by an approved therapist’s numeric ID.'); return; }
    }
    const draft: Draft = { id: randomUUID(), stage: 'content', therapist, button: 'directory' };
    await db.from('telegram_admin_drafts').upsert({ telegram_id: actor, draft, updated_at: new Date().toISOString() }).throwOnError();
    await say(chat, 'Send the announcement text, or upload a photo/video with a caption (up to 900 characters). You can preview before publishing.'); return;
  }
  if (isAdmin && callback?.data === 'draft:new') {
    await db.from('telegram_admin_drafts').upsert({ telegram_id: actor, draft: { id: randomUUID(), stage: 'content', button: 'directory' }, updated_at: new Date().toISOString() }).throwOnError();
    await say(chat, 'Send your announcement text, or a photo/video with a caption.'); return;
  }
  if (isAdmin) {
    const { data: row } = await db.from('telegram_admin_drafts').select('draft').eq('telegram_id', actor).maybeSingle();
    const draft = row?.draft as Draft | undefined;
    if (draft && !callback && !command.startsWith('/') && draft.stage === 'content') {
      const caption = message.caption || message.text || '';
      if (!caption.trim() || caption.length > 900) { await say(chat, 'Please add a caption of 1–900 characters.'); return; }
      draft.caption = caption;
      draft.media = message.video?.file_id || message.photo?.at(-1)?.file_id;
      draft.mediaType = message.video ? 'video' : message.photo ? 'photo' : undefined;
      draft.stage = 'ready';
      await db.from('telegram_admin_drafts').update({ draft }).eq('telegram_id', actor).throwOnError();
      await sendPost(chat, draft, true);
      await say(chat, 'Publish this preview to your official announcement channel?', { inline_keyboard: [
        [{ text: '✓ Publish to Channel', callback_data: `publish:${draft.id}` }, { text: 'Cancel', callback_data: `cancel:${draft.id}` }],
      ] }); return;
    }
    if (draft && callback?.data?.endsWith(draft.id)) {
      if (callback.data.startsWith('cancel:')) { await db.from('telegram_admin_drafts').delete().eq('telegram_id', actor); await say(chat, 'Draft cancelled.'); return; }
      if (callback.data.startsWith('publish:') && draft.stage === 'ready') {
        const channel = process.env.TELEGRAM_ANNOUNCEMENT_CHAT_ID;
        if (!channel) { await say(chat, 'Announcement channel is not configured. Your draft is saved.'); return; }
        const { data: claimed } = await db.from('telegram_admin_drafts').update({ draft: { ...draft, stage: 'publishing' } }).eq('telegram_id', actor).contains('draft', { id: draft.id, stage: 'ready' }).select('telegram_id');
        if (!claimed?.length) return;
        try { await sendPost(channel, draft); }
        catch (error) { await db.from('telegram_admin_drafts').update({ draft }).eq('telegram_id', actor).contains('draft', { id: draft.id }); throw error; }
        await db.from('telegram_admin_drafts').delete().eq('telegram_id', actor).contains('draft', { id: draft.id });
        await say(chat, '✓ Published to official channel.'); return;
      }
    }
  }
  if (callback) return;
  await say(chat, welcomeText, menu());
}
