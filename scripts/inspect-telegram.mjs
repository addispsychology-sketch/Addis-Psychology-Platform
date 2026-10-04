import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
const production=existsSync('.env.broadcast-check.local')?parseEnv(readFileSync('.env.broadcast-check.local','utf8')):{};
const call=async(method,payload={})=>{const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!data.ok)throw new Error('Telegram check failed');return data.result;};
const [me,menu,hook]=await Promise.all([call('getMe'),call('getChatMenuButton'),call('getWebhookInfo')]);
console.log(JSON.stringify({actualBot:{id:me.id,username:me.username,hasMainMiniApp:me.has_main_web_app??false},productionUsername:production.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,localUsername:process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,productionOrigin:production.APP_URL,menu,webhook:hook.url,pendingUpdates:hook.pending_update_count},null,2));
const channel=await call('getChat',{chat_id:'-1002130619828'});
const rights=await call('getChatMember',{chat_id:channel.id,user_id:me.id});
console.log(JSON.stringify({channel:{id:channel.id,title:channel.title,username:channel.username,pinnedMessageId:channel.pinned_message?.message_id},rights:{status:rights.status,canPost:rights.can_post_messages,canEdit:rights.can_edit_messages}},null,2));
