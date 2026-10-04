import 'server-only';
import { randomUUID } from 'node:crypto';
import { serviceDb, siteUrl } from './server-services';
import { miniLink, privateAppButton, telegram, TelegramRejectedError, requireDirectMiniApp } from './telegram-server';
import { normalizePhone } from './booking-validation';
import {announcementChannel} from './channel-server';
import {postText,postActions,postCaptionLength} from './channel-post';
import {MEDIA_CAPTION_LIMIT} from './channel-media';

type BotMessage = { chat: { id: number; type: string }; from?: { id: number; is_bot?: boolean }; text?: string; caption?: string; photo?: { file_id: string }[]; video?: { file_id: string }; contact?: { user_id?: number; phone_number: string } };
export type BotUpdate = { update_id: number; message?: BotMessage; callback_query?: { id: string; from: { id: number }; data?: string; message?: BotMessage } };
type Draft = { id: string; stage: 'content' | 'ready' | 'publishing'; therapist?: number; button: string; title?: string; caption?: string; media?: string; mediaType?: 'photo' | 'video' };

const adminIds = () => (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const say = (chat: number, text: string, reply_markup?: unknown, html = false) => telegram('sendMessage', { chat_id: chat, text, ...(html ? { parse_mode: 'HTML' } : {}), ...(reply_markup ? { reply_markup } : {}) });

/**
 * Clean, balanced 2-row menu without cluttered vertical buttons
 */
const menu = () => ({
  inline_keyboard: [
    [
      { text: '🌿 Open Addis Platform', web_app: { url: siteUrl('/') } },
    ],
    [
      { text: '💬 Messages', web_app: { url: siteUrl('/chat') } },
      { text: '📅 Bookings', web_app: { url: siteUrl('/appointments') } },
    ],
    [
      { text: 'Find a psychologist', web_app: { url: siteUrl('/therapists') } },
      { text: '👤 My Account', web_app: { url: siteUrl('/account') } },
    ],
  ],
});

function draftButtons(draft: Draft, preview: boolean) {
  return postActions(draft.therapist).map(row=>row.map(button=>preview?privateAppButton(button.text,button.path):{text:button.text,url:miniLink(button.path)}));
}

async function sendPost(chat: number | string, draft: Draft, preview = false) {
  const reply_markup = { inline_keyboard: draftButtons(draft,preview) };
  const caption = `${preview && !draft.media ? '<b>PRIVATE PREVIEW</b>\n\n' : ''}${postText(draft.title || (draft.therapist?'Meet your practitioner':'From Addis Psychology'),draft.caption || '')}`;
  if (draft.media && draft.mediaType) return telegram(draft.mediaType === 'photo' ? 'sendPhoto' : 'sendVideo', { chat_id: chat, [draft.mediaType]: draft.media, caption, parse_mode:'HTML',reply_markup,...(draft.mediaType==='video'?{supports_streaming:true}:{}) });
  return telegram('sendMessage', { chat_id: chat, text: caption,parse_mode:'HTML', reply_markup });
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
    '<b>ADDIS PSYCHOLOGY</b>\n' +
    '<b>ድጋፍ። በእርስዎ ምርጫ።</b>\n\n' +
    '<i>Professional support. Space to be heard.</i>\n\n' +
    'A respectful, confidential space to connect with mental health professionals in Addis Ababa.\n\n' +
    '<b>Care that fits your life</b>\n' +
    '• Private, one-to-one text and voice conversations\n' +
    '• Psychologist profiles, specialties and languages\n' +
    '• Online and in-person appointment requests\n' +
    '• Your conversations and bookings in one place\n\n' +
    'Take the next step at your own pace. Choose an option below.' +
    (isAdmin ? '\n\n<b>Administration</b> · /admin' : '');

  if ((command === '/start' || command === '/help') && !callback) {
    const login = text.match(/^\/start(?:@\w+)? login_([a-f0-9-]{36})$/i)?.[1];
    if (login) {
      await say(chat, 'Sign in to Addis Psychology\n\nOpen the button below to approve the sign-in you started on our website. Only approve it if you started this request. Then return to your browser.', { inline_keyboard: [[privateAppButton('Approve website sign-in', '/account?telegramLogin=' + login)]] });
      return;
    }
    await say(chat, welcomeText, menu(), true);
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
    await say(chat, 'Send your announcement, or upload a photo/video with a caption. Use the first line as your heading, followed by the message. You can also upload media first and send its caption next. Media captions must fit within 1,024 characters including the heading and footer. You will receive a private preview before publishing.'); return;
  }
  if (isAdmin && callback?.data === 'draft:new') {
    await db.from('telegram_admin_drafts').upsert({ telegram_id: actor, draft: { id: randomUUID(), stage: 'content', button: 'directory' }, updated_at: new Date().toISOString() }).throwOnError();
    await say(chat, 'Send your announcement, or upload a photo/video. Use the first line of your caption as the heading. You can send the caption with the upload or in your next message. You will receive a private preview before publishing.'); return;
  }
  if (isAdmin) {
    const { data: row } = await db.from('telegram_admin_drafts').select('draft').eq('telegram_id', actor).maybeSingle();
    const draft = row?.draft as Draft | undefined;
    if (draft && !callback && !command.startsWith('/') && draft.stage === 'content') {
      const caption = (message.caption || message.text || '').trim();
      const media=message.video?.file_id || message.photo?.at(-1)?.file_id;
      if(media){draft.media=media;draft.mediaType=message.video?'video':'photo';}
      if(!caption) {
        await db.from('telegram_admin_drafts').update({draft}).eq('telegram_id',actor).throwOnError();
        await say(chat,'Attachment received. Send its caption next, with the heading on the first line.');return;
      }
      const lines=caption.split('\n');
      const hasHeading=lines.length>1 && lines[0].length<=120 && Boolean(lines.slice(1).join('\n').trim());
      draft.title=hasHeading?lines[0]:draft.therapist?'Meet your practitioner':'From Addis Psychology';
      draft.caption=hasHeading?lines.slice(1).join('\n').trim():caption;
      const length=postCaptionLength(draft.title,draft.caption);
      const limit=draft.media?MEDIA_CAPTION_LIMIT:3000;
      if(length>limit) {
        await db.from('telegram_admin_drafts').update({draft}).eq('telegram_id',actor).throwOnError();
        await say(chat,`Please shorten your ${draft.media?'media caption':'message'} by ${length-limit} characters. The heading and footer count toward Telegram’s limit. Your attachment is kept.`);return;
      }
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
        try {await requireDirectMiniApp();}
        catch {await say(chat,'Your preview is ready. Enable the bot’s Main Mini App in BotFather so the channel buttons open the app directly, then tap Publish again.');return;}
        const channel = await announcementChannel();
        const { data: claimed } = await db.from('telegram_admin_drafts').update({ draft: { ...draft, stage: 'publishing' } }).eq('telegram_id', actor).contains('draft', { id: draft.id, stage: 'ready' }).select('telegram_id');
        if (!claimed?.length) return;
        let result;
        try { result=await sendPost(channel, draft); }
        catch (error) {
          if(error instanceof TelegramRejectedError)await db.from('telegram_admin_drafts').update({ draft }).eq('telegram_id', actor).contains('draft', { id: draft.id });
          await say(chat,error instanceof TelegramRejectedError?'Telegram rejected the post. Check the channel permission and try Publish again.':'Telegram did not confirm delivery. Check the channel before making a new announcement.');return;
        }
        if(account)await db.from('channel_posts').insert({id:draft.id,actor:account.user_id,title:draft.title || (draft.therapist?'Meet your practitioner':'From Addis Psychology'),body:draft.caption || '',therapist_id:draft.therapist || null,status:'published',telegram_message_id:result.message_id}).throwOnError();
        await db.from('telegram_admin_drafts').delete().eq('telegram_id', actor).contains('draft', { id: draft.id });
        await say(chat, '✓ Published to official channel.'); return;
      }
    }
  }
  if (callback) return;
  await say(chat, welcomeText, menu(), true);
}
