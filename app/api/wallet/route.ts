import { authorize } from '@/lib/server-auth';
import { serviceDb, apiError } from '@/lib/server-services';
import { birrCents, PACKAGE_PRINCIPAL, serviceFee } from '@/lib/payment-policy';
import { requireTerms } from '@/lib/require-terms';
export async function GET(request: Request) {
 try {
  const {db,user} = await authorize(request);
  const tables=['wallets','credit_lots','payment_requests','session_funds','refund_requests','wallet_ledger','terms_acceptances'];
  const rows=await Promise.all(tables.map(table=>db.from(table).select('*').eq('user_id',user.id).limit(500)));
  if(rows.some(r=>r.error)) throw new Error('Your wallet is temporarily unavailable.');
  return Response.json(Object.fromEntries(tables.map((table,i)=>[table,rows[i].data])),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}
}
export async function POST(request: Request) {
 try {
  const {user}=await authorize(request); await requireTerms(user.id); const input=await request.json();const db=serviceDb();
  if(input.action==='fund-session') {
   throw new Error('Pay your therapist directly after Addis Psychology confirms your booking. Wallet funds are not required.');
  } else if(input.action==='refund') {
   if(!['telebirr','cbe'].includes(input.method) || typeof input.destination!=='string' || !/^[0-9+ ()-]{7,30}$/.test(input.destination)) throw new Error('Enter the account or phone number to receive your refund.');
   const {error}=await db.rpc('request_refund',{client:user.id,credit_id:input.lotId||null,cents:input.lotId?null:birrCents(input.amount),payout_method:input.method,payout_destination:input.destination.trim()});if(error)throw new Error(error.message);
  } else if(input.action==='payment') {
   if(!['text','voice','combined'].includes(input.kind) || !['telebirr','cbe'].includes(input.method) || typeof input.reference!=='string' || !/^[A-Za-z0-9-]{5,100}$/.test(input.reference.trim())) throw new Error('Enter the transaction reference from your bank or Telebirr receipt.');
   const principal=input.kind==='wallet'?birrCents(input.amount):PACKAGE_PRINCIPAL[input.kind as keyof typeof PACKAGE_PRINCIPAL];
   const {error}=await db.from('payment_requests').insert({user_id:user.id,kind:input.kind,principal_cents:principal,fee_cents:serviceFee(principal),method:input.method,reference:input.reference.trim().toUpperCase()});
   if(error)throw new Error(error.code==='23505'?'That transaction reference has already been submitted.':'Could not save this payment. Please try again.');
  } else throw new Error('Unknown wallet action.');
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}
}
