import {equalSecret} from '@/lib/telegram-validation';
import {deliverNotifications} from '@/lib/notifications';
export const maxDuration=60;
export async function POST(request:Request) {
 if(!process.env.NOTIFICATION_JOB_SECRET || !equalSecret(request.headers.get('authorization')||'',`Bearer ${process.env.NOTIFICATION_JOB_SECRET}`)) return new Response('Unauthorized',{status:401});
 try {const result=await deliverNotifications();return Response.json(result,{status:result.failed?207:200});}
 catch {return new Response('Worker unavailable',{status:503});}
}
