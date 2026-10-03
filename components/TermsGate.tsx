'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck, CreditCard, CalendarDays } from 'lucide-react';
import { usePlatform } from './Platform';
import { Modal } from './Shell';
import TermsConsent from './TermsConsent';
import { authenticatedFetch } from '@/lib/supabase';
import { TERMS_VERSION } from '@/lib/payment-policy';
export default function TermsGate() {
  const { userId, wallet, refreshWallet } = usePlatform();
  const path = usePathname();
  const [agree,setAgree] = useState(false);
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [dismissed,setDismissed] = useState(false);
  if (!userId || !wallet || dismissed || path.startsWith('/terms') || path.startsWith('/auth') || path === '/account' || wallet.terms_acceptances.some(x => x.audience === 'client' && x.version === TERMS_VERSION)) return null;
  return <Modal title="Care with clarity." close={() => setDismissed(true)}><div className="terms-welcome"><span className="eyebrow">BEFORE WE BEGIN</span><p>A few things to know about your space.</p><div><ShieldCheck size={22} /><span><strong>Your conversations are private.</strong><small>Email alerts never contain your therapy messages.</small></span></div><div><CreditCard size={22} /><span><strong>Packages and sessions are separate.</strong><small>Packages go to Dawit Aynalem. Confirmed sessions are paid directly to your therapist.</small></span></div><div><CalendarDays size={22} /><span><strong>Clear prices. Room to change plans.</strong><small>Review the 5% package fee, cancellation notice, and unused-credit returns.</small></span></div><TermsConsent checked={agree} onChange={setAgree} /><button className="solid" disabled={!agree || busy} onClick={async () => { setBusy(true); setNotice(''); try { await authenticatedFetch('/api/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted: true, audience: 'client', version: TERMS_VERSION }) }); await refreshWallet(); } catch(e) { setNotice(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }}>{busy ? 'Saving…' : 'Accept and continue →'}</button><button className="care-back" onClick={() => setDismissed(true)}>Keep browsing for now</button>{notice && <p role="alert">{notice}</p>}</div></Modal>;
}
