'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Context, usePlatform } from '@/components/Platform';
import Wallet from '../wallet/page';
import Chat from '../chat/page';
import Account from '@/components/AccountPanel';
import PaymentCheckout from '@/components/PaymentCheckout';
import OnlineTherapistPopup from '@/components/OnlineTherapistPopup';
import { Page } from '@/components/Shell';
function Fixture() {
 const platform=usePlatform(), params=useSearchParams();
 const fixture={...platform,userId:'local-visual-fixture',balance:()=>({texts:76,voiceSeconds:2100}),settings:()=>({...platform.settings(1),presence:'available' as const,chatDays:[0,1,2,3,4,5,6],chatStart:'00:00',chatEnd:'23:59'}),people:[{id:9001,name:'Preview Therapist',title:'Counseling psychologist',specialties:[],bio:'Local visual fixture',education:[],yearsExperience:4,languages:['Amharic','English'],approaches:[],priceOnline:1100,priceInPerson:1500,rating:0,reviewCount:0,availability:'',imageColor:'',gender:'Unspecified' as const}],wallet:{wallets:[],credit_lots:[],payment_requests:[{id:'preview',kind:'combined',principal_cents:57000,fee_cents:2850,method:'telebirr',reference:'PREVIEW-ONLY',status:'pending',created_at:'2026-10-03T10:00:00Z'}],session_funds:[],refund_requests:[],wallet_ledger:[],terms_acceptances:[{audience:'client',version:'2026-10-03.2'}]}};
 return <Context.Provider value={fixture}>{params.get('screen')==='chat'?<Chat/>:params.get('screen')==='account'?<Page><Account/></Page>:params.get('screen')==='payment'?<Page><div className="care-page"><PaymentCheckout kind="combined"/></div></Page>:params.get('screen')==='popup'?<Page><h1>Local preview</h1><OnlineTherapistPopup/></Page>:<Wallet/>}</Context.Provider>;
}
export default function Preview(){return <Suspense><Fixture/></Suspense>}
