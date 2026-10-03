"use client";
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {usePlatform} from './Platform';
import TermsConsent from './TermsConsent';
import {authenticatedFetch} from '@/lib/supabase';
import {TERMS_VERSION} from '@/lib/payment-policy';
export default function TermsGate(){const {userId,wallet,refreshWallet}=usePlatform();const path=usePathname();const [agree,setAgree]=useState(false);const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 if(!userId||!wallet||path.startsWith('/terms')||wallet.terms_acceptances.some(x=>x.audience==='client'&&x.version===TERMS_VERSION))return null;
 return <div className="terms-gate"><section className="care-card" role="dialog" aria-modal="true" aria-labelledby="terms-title"><span className="eyebrow">BEFORE WE BEGIN</span><h2 id="terms-title">Care with clarity.</h2><p>Please review how appointments, privacy, payments and refunds work. You can read the full terms before deciding.</p><TermsConsent checked={agree} onChange={setAgree}/><button className="solid" disabled={!agree||busy} onClick={async()=>{setBusy(true);try{await authenticatedFetch('/api/terms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accepted:true,audience:'client',version:TERMS_VERSION})});await refreshWallet()}catch(e){setNotice(e instanceof Error?e.message:'Try again')}finally{setBusy(false)}}}>Accept and continue →</button>{notice&&<p role="alert">{notice}</p>}</section></div>}
