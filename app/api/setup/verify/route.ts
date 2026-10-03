import nodemailer from 'nodemailer';
import { equalSecret } from '@/lib/telegram-validation';
import { serviceDb } from '@/lib/server-services';

// Read-only diagnostics, protected by the same server-only operations secret.
export async function POST(request: Request) {
  if (!process.env.NOTIFICATION_JOB_SECRET || !equalSecret(request.headers.get('authorization') || '', `Bearer ${process.env.NOTIFICATION_JOB_SECRET}`)) return new Response('Unauthorized', { status: 401 });
  const status: Record<string, string> = {};
  try {
    const { error } = await serviceDb().from('appointments').select('id', { head: true, count: 'exact' });
    status.database = error ? 'unavailable' : 'connected';
  } catch { status.database = 'not configured'; }
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
    const smtp = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: SMTP_PORT === '465', requireTLS: SMTP_PORT !== '465', auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, connectionTimeout: 10000, socketTimeout: 10000 });
    try { await smtp.verify(); status.email = 'SMTP authentication verified; no email sent'; }
    catch { status.email = 'SMTP verification failed'; }
    finally { smtp.close(); }
  } else status.email = 'not configured';
  return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
