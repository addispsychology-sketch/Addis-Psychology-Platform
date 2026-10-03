import { serviceDb } from './server-services';
import { TERMS_VERSION } from './payment-policy';
export async function requireTerms(userId: string) {
 const {data,error} = await serviceDb().from('terms_acceptances').select('version').eq('user_id',userId).eq('audience','client').eq('version',TERMS_VERSION).maybeSingle();
 if(error || !data) throw new Error('Please read and accept the client terms in Account first.');
}
