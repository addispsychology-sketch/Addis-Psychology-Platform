import { authorizeAdmin } from '@/lib/admin-auth';
import { apiError, siteUrl } from '@/lib/server-services';
import { telegram, miniLink } from '@/lib/telegram-server';

export async function POST(request: Request) {
  try {
    await authorizeAdmin(request);
    const { message, type, therapistId } = await request.json();
    const channelId = process.env.TELEGRAM_ANNOUNCEMENT_CHAT_ID;
    
    if (!channelId) throw new Error('TELEGRAM_ANNOUNCEMENT_CHAT_ID is not set in environment.');
    if (!message || message.trim().length === 0) throw new Error('Message cannot be empty.');

    let reply_markup;

    if (type === 'therapist' && therapistId) {
      reply_markup = {
        inline_keyboard: [
          [{ text: '📅 Book a Session', url: miniLink(`/schedule/${therapistId}`) }],
          [{ text: '💬 Text Therapist', url: miniLink(`/chat?therapist=${therapistId}`) },
           { text: '🎙️ Voice Message', url: miniLink(`/chat?therapist=${therapistId}`) }]
        ]
      };
    } else {
      reply_markup = {
        inline_keyboard: [
          [{ text: '🌿 Open Addis Platform', url: miniLink('/') }]
        ]
      };
    }

    await telegram('sendMessage', {
      chat_id: channelId,
      text: message,
      parse_mode: 'HTML',
      reply_markup
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
