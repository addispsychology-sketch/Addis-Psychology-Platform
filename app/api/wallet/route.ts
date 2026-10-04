import {after} from 'next/server';
import {deliverNotifications} from '@/lib/notifications';
import { authorize } from '@/lib/server-auth';
import { serviceDb, apiError } from '@/lib/server-services';
import { birrCents, PACKAGE_PRINCIPAL, serviceFee } from '@/lib/payment-policy';
import { requireTerms } from '@/lib/require-terms';
import { createHash, randomUUID } from 'node:crypto';
import { MAX_PROOF_BYTES, PROOF_BUCKET, proofType } from '@/lib/payment-proof';
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
  const {user}=await authorize(request); await requireTerms(user.id);
  if (Number(request.headers.get('content-length')) > MAX_PROOF_BYTES + 65536) throw new Error('Screenshot must be under 3 MB.');
  const form = request.headers.get('content-type')?.includes('multipart/form-data') ? await request.formData() : null;
  const input = form ? Object.fromEntries(form.entries()) : await request.json();const db=serviceDb();
  if(input.action==='fund-session') {
   throw new Error('Pay your therapist directly after Addis Psychology confirms your booking. Wallet funds are not required.');
  } else if(input.action==='refund') {
   if(!['telebirr','cbe'].includes(input.method) || typeof input.destination!=='string' || !/^[0-9+ ()-]{7,30}$/.test(input.destination)) throw new Error('Enter the account or phone number to receive your refund.');
   const {error}=await db.rpc('request_refund',{client:user.id,credit_id:input.lotId||null,cents:input.lotId?null:birrCents(input.amount),payout_method:input.method,payout_destination:input.destination.trim()});if(error)throw new Error(error.message);
  } else if(input.action==='payment') {
   if(!['text','voice','comprehensive','combined'].includes(input.kind) || !['telebirr','cbe'].includes(input.method)) throw new Error('Select a package and payment method.');
   const file = form?.get('screenshot');
   if (!(file instanceof File) || !file.size || file.size > MAX_PROOF_BYTES) throw new Error('Upload a payment screenshot under 3 MB.');
   const bytes = new Uint8Array(await file.arrayBuffer());
   const contentType = proofType(bytes);
   const hash = createHash('sha256').update(bytes).digest('hex');
   const id = randomUUID();
   const path = `${user.id}/${id}`;
   const upload = await db.storage.from(PROOF_BUCKET).upload(path, bytes, { contentType, upsert: false });
   if (upload.error) throw new Error('Could not upload the screenshot. Please try again.');
   const principal=input.kind==='wallet'?birrCents(input.amount):PACKAGE_PRINCIPAL[input.kind as keyof typeof PACKAGE_PRINCIPAL];
   const {error}=await db.from('payment_requests').insert({id,user_id:user.id,kind:input.kind,principal_cents:principal,fee_cents:serviceFee(principal),method:input.method,reference:`UPLOAD-${id}`,proof_path:path,proof_hash:hash});
   if(error){await db.storage.from(PROOF_BUCKET).remove([path]);throw new Error(error.code==='23505'?'This screenshot has already been submitted. Check your wallet for its status.':'Could not save this payment. Please try again.');}
  } else throw new Error('Unknown wallet action.');
  after(()=>deliverNotifications().then(()=>{}).catch(()=>{}));
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}
}

