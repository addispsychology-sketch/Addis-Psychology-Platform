import { authorizeAdmin } from '@/lib/admin-auth';
import { apiError } from '@/lib/server-services';
import { PROOF_BUCKET } from '@/lib/payment-proof';
export async function GET(request: Request) {
 try {
  const { db } = await authorizeAdmin(request);
  const id = new URL(request.url).searchParams.get('id');
  const { data, error } = await db.from('payment_requests').select('proof_path').eq('id', id).single();
  if (error || !data?.proof_path) throw new Error('Payment screenshot unavailable.');
  const signed = await db.storage.from(PROOF_BUCKET).createSignedUrl(data.proof_path, 300);
  if (signed.error) throw new Error('Could not open the screenshot. Please retry.');
  return Response.json({ url: signed.data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
 } catch (error) { return apiError(error); }
}
