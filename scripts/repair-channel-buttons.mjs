import {createClient} from '@supabase/supabase-js';
import {miniAppLink} from '../lib/telegram-links.ts';
import {postActions} from '../lib/channel-post.ts';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:config,error:configError}=await db.from('platform_config').select('value').eq('key','telegram_announcement_chat_id').single();
const channel=process.env.TELEGRAM_ANNOUNCEMENT_CHAT_ID||config?.value;
if(configError && !channel)throw new Error('Channel is unavailable.');
const {data:posts,error}=await db.from('channel_posts').select('telegram_message_id,therapist_id').eq('status','published').not('telegram_message_id','is',null);
if(error)throw new Error('Could not find published posts.');
for(const post of posts){
 const buttons=postActions(post.therapist_id).map(row=>row.map(b=>({text:b.text,url:miniAppLink(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,b.path,process.env.TELEGRAM_MINI_APP_SHORT_NAME)})));
 const response=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/editMessageReplyMarkup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:channel,message_id:post.telegram_message_id,reply_markup:{inline_keyboard:buttons}}),signal:AbortSignal.timeout(20000)});
 const result=await response.json();
 if(!result.ok && result.description?.toLowerCase().includes('message to edit not found')){console.log('Skipped unavailable channel message '+post.telegram_message_id+'.');continue;}
 if(!result.ok && !result.description?.includes('message is not modified')){
  const reason=['message to edit not found','message can\'t be edited','not enough rights','chat not found','BUTTON_URL_INVALID','BOT_INVALID'].find(value=>result.description?.includes(value)) || (/^Bad Request: [A-Za-z _'.,:-]+$/.test(result.description||'')?result.description:'unspecified rejection');
  throw new Error(`Telegram could not update message ${post.telegram_message_id} in ${channel}: ${result.error_code} (${reason})`);
 }
 console.log('Repaired channel message '+post.telegram_message_id+' with direct Mini App buttons.');
}
