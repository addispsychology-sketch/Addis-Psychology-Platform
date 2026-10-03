'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Page } from '@/components/Shell';
import { getSupabase } from '@/lib/supabase';
function Confirmation() {
  const params = useSearchParams();
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const recovery = params.get('type') === 'recovery';
  return <Page><section className="care-page care-card payment-success"><ShieldCheck size={36} /><span className="eyebrow">YOUR ACCOUNT / ADDIS PSYCHOLOGY</span><h1>{recovery ? 'A fresh start.' : 'One last step.'}</h1><p>{recovery ? 'Continue securely to choose your new password.' : 'Confirm your email to enter your space and find a therapist.'}</p><button className="solid" disabled={busy} onClick={async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const db=getSupabase(); const token=params.get('token_hash'); const type=params.get('type');
      if(!db || !token || !['email','recovery'].includes(type || '')) throw new Error('This confirmation link is incomplete. Please request a new email.');
      const result=await db.auth.verifyOtp({token_hash:token,type:recovery?'recovery':'email'});
      if(result.error || !result.data.session) throw new Error('This link has expired or has already been used. Request a new email, or sign in if you already confirmed.');
      router.replace(recovery?'/account?flow=recovery':'/account?confirmed=1');
    } catch(e) { setError(e instanceof Error?e.message:'Please try again.'); setBusy(false); }
  }}>{busy?'Confirming…':recovery?'Continue to reset password':'Confirm my email'} <ArrowRight size={18} /></button>{error&&<p role="alert">{error}</p>}<Link href="/account">Return to sign in →</Link></section></Page>;
}
export default function ConfirmPage(){return <Suspense fallback={<Page><p>Opening your secure link…</p></Page>}><Confirmation/></Suspense>}
