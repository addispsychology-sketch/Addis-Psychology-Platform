import { pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';

export function integrationConfig(env) {
  const missing = ['APP_URL','SUPABASE_SECRET_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','NOTIFICATION_JOB_SECRET','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM'].filter(key => !env[key]?.trim());
  if (missing.length) throw new Error('Still needed: ' + missing.join(', ') + '. Values are never printed.');
  const url = new URL(env.APP_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('APP_URL must be your HTTPS website origin.');
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET) || env.NOTIFICATION_JOB_SECRET.length < 32) throw new Error('Use generated secrets of at least 32 characters.');
  return { ...env, APP_URL: url.origin, SMTP_PASSWORD: env.SMTP_HOST === 'smtp.gmail.com' ? env.SMTP_PASSWORD.replace(/\s/g, '') : env.SMTP_PASSWORD };
}

export async function configureTelegram(env, request = fetch, replaceWebhook = false) {
  const config = integrationConfig(env);
  const api = async (method, payload = {}) => {
    const response = await request(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) }).catch(() => { throw new Error('Telegram network request failed.'); });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(`Telegram setup failed at ${method}. Check the replacement token and bot settings.`);
    return body.result;
  };
  const me = await api('getMe');
  if (me.username?.toLowerCase() !== config.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.toLowerCase()) throw new Error('This token belongs to a different bot. Nothing was changed.');
  const webhook = await api('getWebhookInfo');
  const target = config.APP_URL + '/api/telegram/webhook';
  if (webhook.url && webhook.url !== target && !replaceWebhook) throw new Error('The bot has an existing webhook for another application. Review it before running with --replace-webhook.');
  await api('setWebhook', { url: target, secret_token: config.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message','callback_query'], drop_pending_updates: false });
  await api('setChatMenuButton', { menu_button: { type:'web_app', text:'Open Addis', web_app:{url:config.APP_URL+'/account'} } });
  await api('setMyCommands', { commands: [
    {command:'start',description:'Open Addis and see your options'},
    {command:'phone',description:'Verify your own phone for sign-in'},
    {command:'stop',description:'Pause Telegram notifications'},
    {command:'id',description:'Show your Telegram account ID'},
  ] });
  for (const id of (config.TELEGRAM_ADMIN_IDS || '').split(',').map(s=>s.trim()).filter(Boolean)) {
    if (!/^\d+$/.test(id)) throw new Error('Administrator IDs must be numbers.');
    await api('setMyCommands', { scope:{type:'chat',chat_id:Number(id)}, commands:[
      {command:'start',description:'Open Addis'}, {command:'admin',description:'Publishing studio'},
      {command:'announce',description:'Create an announcement'}, {command:'promote',description:'Promote a therapist by directory ID'},
      {command:'phone',description:'Verify phone number'}, {command:'stop',description:'Pause alerts'}, {command:'id',description:'Show my ID'},
    ] });
  }
  return 'Telegram webhook, Mini App menu, and commands configured. Set the Main Mini App URL in BotFather to the same APP_URL for channel promotion links.';
}

export async function verifyEmail(env) {
  const config = integrationConfig(env);
  const smtp = nodemailer.createTransport({ host:config.SMTP_HOST, port:Number(config.SMTP_PORT), secure:config.SMTP_PORT==='465', requireTLS:config.SMTP_PORT!=='465', auth:{user:config.SMTP_USER,pass:config.SMTP_PASSWORD}, connectionTimeout:10000, socketTimeout:10000 });
  try { await smtp.verify(); return 'SMTP authentication verified. No email was sent.'; }
  catch { throw new Error('SMTP sign-in failed. For Gmail, use a Google app password with 2-Step Verification enabled.'); }
  finally { smtp.close(); }
}

export async function configureAuthEmail(env, request = fetch) {
  const config = integrationConfig(env);
  if (!config.SUPABASE_ACCESS_TOKEN || !config.SUPABASE_PROJECT_ID) throw new Error('Supabase management access is needed to connect sign-up emails. Appointment SMTP is separate.');
  const response = await request(`https://api.supabase.com/v1/projects/${config.SUPABASE_PROJECT_ID}/config/auth`, {
    method:'PATCH', headers:{Authorization:`Bearer ${config.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({ smtp_host:config.SMTP_HOST,smtp_port:config.SMTP_PORT,smtp_user:config.SMTP_USER,smtp_pass:config.SMTP_PASSWORD,smtp_admin_email:config.SMTP_USER,smtp_sender_name:'Addis Psychology',mailer_autoconfirm:false }),
    signal:AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Supabase email setup failed. Check management permissions; no secret values were printed.');
  return 'Supabase confirmation and recovery emails now use your SMTP account; email confirmation remains enabled.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    integrationConfig(process.env);
    if (process.argv.includes('--email')) console.log(await verifyEmail(process.env));
    if (process.argv.includes('--auth-email')) console.log(await configureAuthEmail(process.env));
    if (process.argv.includes('--telegram')) console.log(await configureTelegram(process.env, fetch, process.argv.includes('--replace-webhook')));
    if (!process.argv.some(a=>['--email','--auth-email','--telegram'].includes(a))) console.log('Required messaging setup values are present. No external changes made.');
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
