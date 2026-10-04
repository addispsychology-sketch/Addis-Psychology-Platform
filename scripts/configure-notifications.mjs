import {createClient} from '@supabase/supabase-js';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const channel='-1002130619828';
const bot=async(method,body)=>{
 const res=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await res.json();if(!res.ok || !data.ok)throw new Error('Could not verify Telegram channel permissions.');return data.result;
};
const [chat,identity]=await Promise.all([bot('getChat',{chat_id:channel}),bot('getMe',{})]);
const member=await bot('getChatMember',{chat_id:channel,user_id:identity.id});
if(member.status!=='creator' && !(member.status==='administrator' && member.can_post_messages))throw new Error('Bot needs channel posting permission.');
const config=[{key:'telegram_announcement_chat_id',value:channel}];
if(process.argv.includes('--enable')) {
 const ids=(process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(v=>v.trim()).filter(v=>/^\d+$/.test(v));
 if(!ids.length)throw new Error('Administrator recipients are missing.');
 config.push({key:'telegram_admin_ids',value:ids.join(',')});
 const {error}=await db.rpc('configure_notification_worker',{worker_url:'https://addis-psychology-platform.vercel.app/api/jobs/notifications',worker_secret:process.env.NOTIFICATION_JOB_SECRET});
 if(error)throw new Error('Worker configuration could not be saved.');
}
const {error}=await db.from('platform_config').upsert(config);
if(error)throw new Error('Channel configuration could not be saved.');
console.log(`Channel connected: ${chat.title}. Posting permission verified. No announcement published.`);
if(process.argv.includes('--enable'))console.log('Administrator recipients and conditional notification scheduler enabled.');
