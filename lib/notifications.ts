import 'server-only';
import nodemailer from 'nodemailer';
import { serviceDb, siteUrl } from '@/lib/server-services';
import { privateAppButton, telegram } from '@/lib/telegram-server';
import { renderAppointmentEmail, renderNewMessageEmail } from '@/lib/email-templates';

export async function deliverNotifications() {
  const db = serviceDb();
  const { data: jobs, error } = await db.rpc('claim_notification_jobs');
  if (error) throw new Error('Worker unavailable');
  let delivered = 0;
  let failed = 0;
  const smtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', requireTLS: process.env.SMTP_PORT !== '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }, connectionTimeout: 10000, socketTimeout: 10000 }) : null;

  for (let offset = 0; offset < (jobs || []).length; offset += 10) {
    await Promise.all(jobs.slice(offset, offset + 10).map(async (job: { id: number; lease_token: string; recipient: string | null; admin_chat_id: number | null; conversation_id:string|null; message_at:string|null; channel: string; kind: string; appointment_id: string | null; summary: string; path: string; attempts: number }) => {
      try {
        let skip=false;
        if(job.recipient) {
          const {data:prefs,error:prefsError}=await db.from('account_preferences').select('*').eq('user_id',job.recipient).maybeSingle();
          if(prefsError) throw new Error('Preferences unavailable');
          skip=job.channel==='telegram'?prefs?.telegram_notifications===false:prefs?.email_notifications===false;
        }
        if(job.kind==='message' && job.recipient && job.conversation_id) {
          const [activity,read,recent]=await Promise.all([
            db.from('user_activity').select('last_seen_at').eq('user_id',job.recipient).maybeSingle(),
            db.from('conversation_reads').select('read_at').eq('user_id',job.recipient).eq('conversation_id',job.conversation_id).maybeSingle(),
            db.from('notification_jobs').select('id').eq('recipient',job.recipient).eq('conversation_id',job.conversation_id).eq('kind','message').is('last_error',null).gte('delivered_at',new Date(Date.now()-300000).toISOString()).limit(1)
          ]);
          if(activity.error || read.error || recent.error) throw new Error('Notification status unavailable');
          if(activity.data && Date.now()-Date.parse(activity.data.last_seen_at)<120000) skip=true;
          if(read.data && job.message_at && Date.parse(read.data.read_at)>=Date.parse(job.message_at)) skip=true;
          if(recent.data?.length) skip=true;
          if(jobs.some((other:{id:number;recipient:string|null;conversation_id:string|null;kind:string})=>other.id<job.id && other.kind==='message' && other.recipient===job.recipient && other.conversation_id===job.conversation_id)) skip=true;
        }
        let summary = job.summary;
        if (job.appointment_id) {
          const { data: a, error: appointmentError } = await db.from('appointments').select('status,starts_at').eq('id', job.appointment_id).single();
          if (appointmentError) throw new Error('Appointment unavailable');
          if (job.kind === 'reminder' && (a.status !== 'confirmed' || Date.parse(a.starts_at) <= Date.now())) skip = true;
          if (job.kind === 'appointment' && !summary.includes(a.status)) skip = true;
          summary += '\n' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.starts_at)) + ' · Addis Ababa time (UTC+3)';
        }

        if (!skip && job.channel === 'telegram') {
          let chatId=job.admin_chat_id;
          if(!chatId && job.recipient) {
            const {data:account,error:accountError}=await db.from('telegram_accounts').select('chat_id').eq('user_id',job.recipient).maybeSingle();
            if(accountError) throw new Error('Contact unavailable');
            chatId=account?.chat_id;
          }
          if(chatId) {
            const escape=(value:string)=>value.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
            const titles:Record<string,string>={message:'💬 New private message',admin_booking:'📅 New booking request',admin_payment:'🧾 Payment screenshot received',payment:'✓ Package payment update',reminder:'📅 Your session reminder',appointment:'📅 Appointment update'};
            const body=job.kind==='message'?'A confidential message is waiting in your workspace. Open your conversation to read or listen.':summary;
            const label=job.admin_chat_id?'Open admin review':job.kind==='message'?'Open private conversation':job.kind==='payment'?'View my wallet':'View appointment';
            await telegram('sendMessage',{chat_id:chatId,parse_mode:'HTML',text:`<b>ADDIS PSYCHOLOGY</b>\n\n<b>${titles[job.kind]||'Platform update'}</b>\n\n${escape(body)}`,reply_markup:{inline_keyboard:[[privateAppButton(label,job.path)]]}});
          } else skip=true;
        }

        if (!skip && job.channel === 'email' && job.recipient) {
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
  return {deliveredOrSkipped:delivered,failed};
}
