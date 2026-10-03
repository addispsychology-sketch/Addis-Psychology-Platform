import { authorize } from '@/lib/server-auth';
import { serviceDb, apiError } from '@/lib/server-services';
import { TERMS_VERSION } from '@/lib/payment-policy';
export async function POST(request: Request) {
 try {
  const { user } = await authorize(request); const input = await request.json();
  if (input.accepted !== true || !['client','therapist'].includes(input.audience) || input.version !== TERMS_VERSION) throw new Error('Read and accept the current terms.');
  const { error } = await serviceDb().from('terms_acceptances').upsert({user_id:user.id,audience:input.audience,version:TERMS_VERSION},{onConflict:'user_id,audience,version',ignoreDuplicates:true});
  if(error) throw new Error('Could not save your acceptance.');
  return Response.json({ok:true});
 } catch(error) { return apiError(error); }
}
