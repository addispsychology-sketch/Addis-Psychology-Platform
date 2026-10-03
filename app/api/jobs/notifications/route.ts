import nodemailer from 'nodemailer';
import { equalSecret } from '@/lib/telegram-validation';
import { serviceDb, siteUrl } from '@/lib/server-services';
import { miniLink, telegram } from '@/lib/telegram-server';
import { renderAppointmentEmail, renderNewMessageEmail } from '@/lib/email-templates';

export const maxDuration = 60;
export async function POST(request: Request) {
  if (!equalSecret(request.headers.get('authorization') || '', `Bearer ${process.env.NOTIFICATION_JOB_SECRET || ''}`) || !process.env.NOTIFICATION_JOB_SECRET) return new Response('Unauthorized', { status: 401 });
  const db = serviceDb();
  const { data: jobs, error } = await db.rpc('claim_notification_jobs');
  if (error) return new Response('Worker unavailable', { status: 503 });
  let delivered = 0;
  let failed = 0;
  const smtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', requireTLS: process.env.SMTP_PORT !== '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }, connectionTimeout: 10000, socketTimeout: 10000 }) : null;

  for (let offset = 0; offset < (jobs || []).length; offset += 10) {
    await Promise.all(jobs.slice(offset, offset + 10).map(async (job: { id: number; lease_token: string; recipient: string; channel: string; kind: string; appointment_id: string | null; summary: string; path: string; attempts: number }) => {
      try {
        const { data: prefs, error: prefsError } = await db.from('account_preferences').select('*').eq('user_id', job.recipient).maybeSingle();
        if (prefsError) throw new Error('Preferences unavailable');
        let skip = job.channel === 'telegram' ? prefs?.telegram_notifications === false : prefs?.email_notifications === false;
        let summary = job.summary;
        if (job.appointment_id) {
          const { data: a, error: appointmentError } = await db.from('appointments').select('status,starts_at').eq('id', job.appointment_id).single();
          if (appointmentError) throw new Error('Appointment unavailable');
          if (job.kind === 'reminder' && (a.status !== 'confirmed' || Date.parse(a.starts_at) <= Date.now())) skip = true;
          if (job.kind === 'appointment' && !summary.includes(a.status)) skip = true;
          summary += '\n' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.starts_at)) + ' · Addis Ababa time (UTC+3)';
        }

        if (!skip && job.channel === 'telegram') {
          const { data: account, error: accountError } = await db.from('telegram_accounts').select('chat_id').eq('user_id', job.recipient).maybeSingle();
          if (accountError) throw new Error('Contact unavailable');
          if (account?.chat_id) {
            const telegramText = job.kind === 'message'
              ? `💬 Addis Psychology — New Message\n\nYou received a new confidential message in your workspace. Message contents are kept private.\n\nTap below to open your secure chat:`
              : `🌿 Addis Psychology\n\n${summary}`;
            const buttonLabel = job.kind === 'message' ? '💬 Open private conversation' : '📅 View appointment';
            await telegram('sendMessage', {
              chat_id: account.chat_id,
              text: telegramText,
              reply_markup: { inline_keyboard: [[{ text: buttonLabel, url: miniLink(job.path) }]] },
            });
          } else {
            skip = true;
          }
        }

        if (!skip && job.channel === 'email') {
          const { data: { user }, error: userError } = await db.auth.admin.getUserById(job.recipient);
          if (userError) throw new Error('Contact unavailable');
          if (user?.email && user.email_confirmed_at && !user.email.endsWith('@telegram.addis.invalid')) {
            if (!smtp) throw new Error('Email awaiting setup');
            const recipientName = user.user_metadata?.full_name || 'Practitioner';

            if (job.kind === 'message') {
              const emailContent = renderNewMessageEmail({
                therapistName: recipientName,
                clientInitials: recipientName.slice(0, 2).toUpperCase(),
                chatUrl: siteUrl(job.path),
                accountUrl: siteUrl('/account'),
              });
              await smtp.sendMail({
                from: process.env.SMTP_FROM,
                to: user.email,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
              });
            } else {
              const emailContent = renderAppointmentEmail({
                recipientName,
                summary,
                appointmentPath: siteUrl(job.path),
                accountPath: siteUrl('/account'),
                isReminder: job.kind === 'reminder',
              });
              await smtp.sendMail({
                from: process.env.SMTP_FROM,
                to: user.email,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
              });
            }
          } else {
            skip = true;
          }
        }
        const { error: saveError } = await db.from('notification_jobs').update({ delivered_at: new Date().toISOString(), last_error: skip ? 'Skipped: disabled, no verified destination, or superseded' : null, lease_until: null }).eq('id', job.id).eq('lease_token', job.lease_token);
        if (saveError) throw new Error('Delivery acknowledgement failed');
        delivered++;
      } catch {
        failed++;
        await db.from('notification_jobs').update({ lease_until: null, due_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)).toISOString(), last_error: 'Delivery failed. Check provider setup and retry from the queue.' }).eq('id', job.id).eq('lease_token', job.lease_token);
      }
    }));
  }
  return Response.json({ deliveredOrSkipped: delivered, failed }, { status: failed ? 207 : 200 });
}
