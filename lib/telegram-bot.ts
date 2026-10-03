import 'server-only';
import { randomUUID } from 'node:crypto';
import { serviceDb, siteUrl } from './server-services';
import { miniLink, telegram } from './telegram-server';
import { normalizePhone } from './booking-validation';

type BotMessage = { chat: { id: number; type: string }; from?: { id: number; is_bot?: boolean }; text?: string; caption?: string; photo?: { file_id: string }[]; video?: { file_id: string }; contact?: { user_id?: number; phone_number: string } };
export type BotUpdate = { update_id: number; message?: BotMessage; callback_query?: { id: string; from: { id: number }; data?: string; message?: BotMessage } };
type Draft = { id: string; stage: 'content' | 'ready' | 'publishing'; therapist?: number; button: string; caption?: string; media?: string; mediaType?: 'photo' | 'video' };
const actions: Record<string, { label: string; path: string }> = {
  directory: { label: '🌿 Find a therapist', path: '/therapists' },
  appointments: { label: '📅 My appointments', path: '/appointments' },
  packages: { label: '✨ Credit packages', path: '/packages' },
  register: { label: '🩺 Join as a therapist', path: '/register' },
  account: { label: '👤 My account', path: '/account' },
  chat: { label: '💬 Private messages', path: '/chat' },
};
const adminIds = () => (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const say = (chat: number, text: string, reply_markup?: unknown) => telegram('sendMessage', { chat_id: chat, text, ...(reply_markup ? { reply_markup } : {}) });
const menu = () => ({ inline_keyboard: Object.values(actions).map(a => [{ text: a.label, web_app: { url: siteUrl(a.path) } }]) });

function draftButtons(draft: Draft) {
  if (draft.therapist) return [[{ text: '📅 Book this therapist', url: miniLink(`/schedule/${draft.therapist}`) }, { text: '💬 Chat with therapist', url: miniLink(`/chat?therapist=${draft.therapist}`) }]];
  const action = actions[draft.button];
  return action ? [[{ text: action.label, url: miniLink(action.path) }]] : [];
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
  if (command === '/id' && !callback) { await say(chat, `Your Telegram ID: ${actor}\n\nUse this number when setting up administrator access.`); return; }
  const { data: account, error: accountError } = await db.from('telegram_accounts').select('user_id').eq('telegram_id', actor).maybeSingle();
  if (accountError) throw new Error('Database unavailable.');
  if (account && !callback) {
    const { error } = await db.from('telegram_accounts').update({ chat_id: chat }).eq('user_id', account.user_id);
    if (error) throw new Error('Database unavailable.');
  }
  const isAdmin = adminIds().includes(String(actor));
  if ((command === '/start' || command === '/help') && !callback) {
    await say(chat, '🌿 Welcome to Addis Psychology\n\nA little space for you. Find a therapist, request a session, or continue a private conversation.\n\nOpen My account below to connect Telegram. Use /phone to enable phone sign-in, /stop to pause notifications.' + (isAdmin ? '\n\nAdministrator: /admin' : ''), menu());
    return;
  }
  if (command === '/stop' && account && !callback) {
    await db.from('account_preferences').upsert({ user_id: account.user_id, telegram_notifications: false });
    await say(chat, '🔕 Telegram notifications paused. You can turn them back on in Account.', menu()); return;
  }
  if (message.contact && !callback) {
    if (!account) { await say(chat, 'First open My account below and connect Telegram, then use /phone again.', menu()); return; }
    if (message.contact.user_id !== actor) { await say(chat, 'Use the “Share my phone” button to share your own verified number.'); return; }
    const phone = normalizePhone('+' + message.contact.phone_number.replace(/^\+/, ''));
    const { error } = await db.from('telegram_accounts').update({ verified_phone: phone }).eq('user_id', account.user_id);
    await say(chat, error ? 'This phone number could not be connected. It may belong to another Addis account. Your existing sign-in still works.' : '✓ Phone verified. Open Account and set a password. You can then sign in on the website using this phone number and password.', { remove_keyboard: true });
    return;
  }
  if (command === '/phone' && !callback) {
    await say(chat, 'Share your own phone number to enable phone-and-password sign-in. Your number stays private.', { keyboard: [[{ text: 'Share my phone', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }); return;
  }
  if (isAdmin && !callback && (command === '/admin' || command === '/announce' || command === '/promote')) {
    if (command === '/admin') {
      await say(chat, '📣 Publishing studio\n\nCreate an announcement, choose its destination button, then preview before publishing.\n\nFor a therapist promotion, send /promote followed by the therapist’s directory ID. Upload a photo or video with a caption when prompted.', { inline_keyboard: [[{ text: '✍️ New announcement', callback_data: 'draft:new' }]] }); return;
    }
    const therapist = command === '/promote' ? Number(text.split(/\s+/)[1]) : undefined;
    if (command === '/promote') {
      const { data: p } = await db.from('practitioners').select('id').eq('id', therapist).eq('approved', true).maybeSingle();
      if (!p) { await say(chat, 'Send /promote followed by an approved therapist’s ID, shown at the end of their directory profile link.'); return; }
    }
    const draft: Draft = { id: randomUUID(), stage: 'content', therapist, button: 'directory' };
    await db.from('telegram_admin_drafts').upsert({ telegram_id: actor, draft, updated_at: new Date().toISOString() }).throwOnError();
    await say(chat, 'Send the announcement text, or upload one photo/video with a caption (up to 900 characters). You will preview it before publishing.'); return;
  }
  if (isAdmin && callback?.data === 'draft:new') {
    await db.from('telegram_admin_drafts').upsert({ telegram_id: actor, draft: { id: randomUUID(), stage: 'content', button: 'directory' }, updated_at: new Date().toISOString() }).throwOnError();
    await say(chat, 'Send your announcement text, or a photo/video with a caption (up to 900 characters).'); return;
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
      await say(chat, 'Choose a destination button, or publish this preview to your official announcement channel.', { inline_keyboard: [
        ...(!draft.therapist ? Object.entries(actions).map(([key, a]) => [{ text: a.label, callback_data: `button:${key}:${draft.id}` }]) : []),
        [{ text: '✓ Publish to channel', callback_data: `publish:${draft.id}` }, { text: 'Cancel', callback_data: `cancel:${draft.id}` }],
      ] }); return;
    }
    if (draft && callback?.data?.endsWith(draft.id)) {
      if (callback.data.startsWith('cancel:')) { await db.from('telegram_admin_drafts').delete().eq('telegram_id', actor); await say(chat, 'Draft cancelled.'); return; }
      if (callback.data.startsWith('button:') && draft.stage === 'ready' && !draft.therapist) {
        const key = callback.data.split(':')[1];
        if (actions[key]) { draft.button = key; await db.from('telegram_admin_drafts').update({ draft }).eq('telegram_id', actor).throwOnError(); await sendPost(chat, draft, true); }
        return;
      }
      if (callback.data.startsWith('publish:') && draft.stage === 'ready') {
        const channel = process.env.TELEGRAM_ANNOUNCEMENT_CHAT_ID;
        if (!channel) { await say(chat, 'Your announcement channel is not connected yet. Your draft is saved.'); return; }
        const { data: claimed } = await db.from('telegram_admin_drafts').update({ draft: { ...draft, stage: 'publishing' } }).eq('telegram_id', actor).contains('draft', { id: draft.id, stage: 'ready' }).select('telegram_id');
        if (!claimed?.length) return;
        try { await sendPost(channel, draft); }
        catch (error) { await db.from('telegram_admin_drafts').update({ draft }).eq('telegram_id', actor).contains('draft', { id: draft.id }); throw error; }
        await db.from('telegram_admin_drafts').delete().eq('telegram_id', actor).contains('draft', { id: draft.id });
        await say(chat, '✓ Published to your official channel.'); return;
      }
    }
  }
  if (callback) return;
  await say(chat, '🌿 Welcome to Addis Psychology\n\nA little space for you. Find a therapist, request a session, or continue a private conversation.\n\nOpen My account to connect Telegram. Use /phone to enable phone sign-in, /stop to pause alerts.' + (isAdmin ? '\n\nAdministrator: /admin' : ''), menu());
}
