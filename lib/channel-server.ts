import 'server-only';
import { serviceDb } from './server-services';
export async function announcementChannel() {
 if(process.env.TELEGRAM_ANNOUNCEMENT_CHAT_ID) return process.env.TELEGRAM_ANNOUNCEMENT_CHAT_ID;
 const {data,error}=await serviceDb().from('platform_config').select('value').eq('key','telegram_announcement_chat_id').maybeSingle();
 if(error || !data?.value) throw new Error('Connect your announcement channel before publishing.');
 return data.value;
}
