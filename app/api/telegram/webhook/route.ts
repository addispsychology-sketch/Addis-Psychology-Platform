import { handleBotUpdate, type BotUpdate } from '@/lib/telegram-bot';
import { equalSecret } from '@/lib/telegram-validation';
import { serviceDb } from '@/lib/server-services';

export async function POST(request: Request) {
  if (!equalSecret(request.headers.get('x-telegram-bot-api-secret-token') || '', process.env.TELEGRAM_WEBHOOK_SECRET || '')) return new Response('Unauthorized', { status: 401 });
  try {
    const raw = await request.text();
    if (raw.length > 65536) return new Response('Too large', { status: 413 });
    const update = JSON.parse(raw) as BotUpdate;
    if (!Number.isSafeInteger(update.update_id)) return new Response('Invalid update', { status: 400 });
    const db = serviceDb();
    const { data: lease, error: claimError } = await db.rpc('claim_telegram_update', { incoming_id: update.update_id });
    if (claimError) throw new Error('Unavailable');
    if (!lease) {
      const { data } = await db.from('telegram_updates').select('processed_at').eq('update_id', update.update_id).single();
      return data?.processed_at ? Response.json({ ok: true }) : new Response('Processing', { status: 503 });
    }
    try { await handleBotUpdate(update); }
    catch { await db.from('telegram_updates').update({ lease_until: new Date(0).toISOString() }).eq('update_id', update.update_id).eq('lease_token', lease); throw new Error('Unavailable'); }
    await db.from('telegram_updates').update({ processed_at: new Date().toISOString() }).eq('update_id', update.update_id).eq('lease_token', lease).throwOnError();
    return Response.json({ ok: true });
  } catch { return new Response('Temporarily unavailable', { status: 503 }); }
}
