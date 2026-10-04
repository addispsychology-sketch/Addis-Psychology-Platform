import {after} from 'next/server';
import {deliverNotifications} from '@/lib/notifications';
import { authorizeAdmin } from '@/lib/admin-auth';
import { apiError } from '@/lib/server-services';
export async function GET(request: Request) {
 try {
  const {db}=await authorizeAdmin(request);
  const page=Math.max(1,Math.min(1000,Number(new URL(request.url).searchParams.get('page'))||1));
  const [users,practices,applications,payments,refunds,requests,statuses,appointments]=await Promise.all([
    db.auth.admin.listUsers({page,perPage:100}),
    db.from('practitioners').select('*').limit(500),
    db.from('practice_applications').select('*').limit(500),
    db.from('payment_requests').select('*').order('created_at',{ascending:false}).limit(200),
    db.from('refund_requests').select('*').order('requested_at',{ascending:false}).limit(200),
    db.from('appointment_requests').select('*').eq('status','pending').limit(200),
    db.from('account_status').select('*').limit(500),
    db.from('appointments').select('*').order('starts_at',{ascending:false}).limit(500)
  ]);
  if([users,practices,applications,payments,refunds,requests,statuses,appointments].some(x=>x.error)) throw new Error('Administration data unavailable.');
  const appMap = new Map((applications.data || []).map(a => [a.user_id, a]));
  const mergedPractices = (practices.data || []).map(p => ({
    ...p,
    application: appMap.get(p.user_id) || null
  }));
  return Response.json({users:users.data.users.map(u=>({id:u.id,email:u.email,name:typeof u.user_metadata.full_name==='string'?u.user_metadata.full_name:'Member'})),practices:mergedPractices,payments:payments.data,refunds:refunds.data,requests:requests.data,statuses:statuses.data,appointments:appointments.data,page},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}
}
export async function POST(request: Request) {
 try {
  const {db,user}=await authorizeAdmin(request); const input=await request.json();
  if(input.action==='booking') {
   if(!['confirmed','cancelled','completed'].includes(input.status)) throw new Error('Invalid booking status.');
   const {data:appointment,error:readError}=await db.from('appointments').select('id,status,starts_at').eq('id',input.id).single();
   if(readError || !appointment || ['cancelled','completed'].includes(appointment.status)) throw new Error('This booking is unavailable or already closed.');
   if(input.status==='confirmed' && (appointment.status!=='pending' || Date.parse(appointment.starts_at)<=Date.now())) throw new Error('Only a future pending request can be confirmed.');
   if(input.status==='completed' && (appointment.status!=='confirmed' || Date.parse(appointment.starts_at)>Date.now())) throw new Error('Only a confirmed session that has started can be completed.');
   const {data:updated,error}=await db.from('appointments').update({status:input.status}).eq('id',input.id).eq('status',appointment.status).select('id');
   if(error || !updated?.length) throw new Error('Booking changed. Refresh and try again.');
  } else if(input.action==='payment') {
   if(input.approve===true && input.verified!==true) throw new Error('Review the payment screenshot and match the amount, recipient and transaction to your bank records first.');
   const {error}=await db.rpc('review_payment',{request_id:input.id,actor:user.id,approve:input.approve===true});if(error)throw new Error(error.message);
  } else if(input.action==='refund') {
   if(input.transferred!==true) throw new Error('Complete the bank transfer before recording it.');
   const {error}=await db.rpc('complete_refund',{request_id:input.id,actor:user.id,bank_reference:input.reference});if(error)throw new Error(error.message);
  } else if(input.action==='practice') {
   const {error}=await db.from('practitioners').update({approved:input.approved===true}).eq('id',input.id);if(error)throw new Error('Could not update practice.');
  } else if(['suspend','restore','delete'].includes(input.action)) {
   if(input.id===user.id)throw new Error('You cannot change your own administrator account here.');
   const {data:target}=await db.from('telegram_accounts').select('telegram_id').eq('user_id',input.id).maybeSingle();
   if(target && (process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(s=>s.trim()).includes(String(target.telegram_id)))throw new Error('Administrator accounts are protected.');
   if(input.action==='delete') {
    if(input.confirmation!=='DELETE')throw new Error('Type DELETE to confirm account removal.');
    const [wallet,lots,funds,refunds,payments,practice]=await Promise.all([db.from('wallets').select('*').eq('user_id',input.id),db.from('credit_lots').select('*').eq('user_id',input.id),db.from('session_funds').select('*').eq('user_id',input.id).eq('status','reserved'),db.from('refund_requests').select('*').eq('user_id',input.id).eq('status','requested'),db.from('payment_requests').select('*').eq('user_id',input.id).eq('status','pending'),db.from('practitioners').select('id').eq('user_id',input.id).maybeSingle()]);
    if([wallet,lots,funds,refunds,payments,practice].some(x=>x.error))throw new Error('Unable to check outstanding obligations.');
    let bookings=db.from('appointments').select('id').in('status',['pending','confirmed']);bookings=practice.data?bookings.or(`client_id.eq.${input.id},therapist_id.eq.${practice.data.id}`):bookings.eq('client_id',input.id);
    const appointments=await bookings;
    if(appointments.error || appointments.data?.length || wallet.data?.some(x=>x.available_cents>0)||lots.data?.some(x=>x.texts||x.voice_seconds)||funds.data?.length||refunds.data?.length||payments.data?.length)throw new Error('Resolve appointments, credits, payments and refunds before deleting this account. You may suspend access meanwhile.');
   }
   await db.from('account_status').upsert({user_id:input.id,status:input.action==='restore'?'active':input.action==='delete'?'deleted':'suspended',updated_at:new Date().toISOString()}).throwOnError();
   if(input.action!=='restore')await db.from('practitioners').update({approved:false}).eq('user_id',input.id).throwOnError();
   const changed=input.action==='delete'?await db.auth.admin.deleteUser(input.id,true):await db.auth.admin.updateUserById(input.id,{ban_duration:input.action==='restore'?'none':'876000h'});
   if(changed.error)throw new Error('Access is restricted, but the identity update needs retrying.');
  } else throw new Error('Unknown administrator action.');
  await db.from('admin_audit').insert({actor:user.id,action:input.action,target:String(input.id)}).throwOnError();
  after(()=>deliverNotifications().then(()=>{}).catch(()=>{}));
  return Response.json({ok:true});
 }catch(error){return apiError(error)}
}

