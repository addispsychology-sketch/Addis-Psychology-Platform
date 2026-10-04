'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Context, usePlatform } from '@/components/Platform';
import Wallet from '@/app/wallet/page';
import Chat from '@/app/chat/page';
import Directory from '@/app/therapists/page';
import Account from '@/components/AccountPanel';
import PaymentCheckout from '@/components/PaymentCheckout';
import OnlineTherapistPopup from '@/components/OnlineTherapistPopup';
import { Page } from '@/components/Shell';
import AdminBroadcast from '@/components/AdminBroadcast';
import { useConversationActivity } from '@/lib/useConversationActivity';
function ActivityHarness({conversation}:{conversation:string}) {
 const {userId}=usePlatform();
 const [recording,setRecording]=useState(false);
 const activity=useConversationActivity(conversation,userId,recording);
 return <Page><h1>Local activity verification</h1><p>Signed in: {userId?'yes':'no'}</p><label>Test client typing<input onChange={e=>activity.typing(Boolean(e.target.value))}/></label><button onClick={()=>setRecording(v=>!v)}>{recording?'Stop recording signal':'Start recording signal'}</button><button onClick={activity.stop}>Stop typing signal</button></Page>;
}
function Fixture() {
 const platform=usePlatform(), params=useSearchParams();
 if(params.get('screen')==='activity')return <ActivityHarness conversation={params.get('conversation')||''}/>;
 if(params.get('screen')==='live-client')return <Context.Provider value={{...platform,balance:()=>({texts:10,voiceSeconds:30})}}><Chat/></Context.Provider>;
 const fixture={...platform,userId:'local-visual-fixture',balance:()=>({texts:76,voiceSeconds:2100}),settings:()=>({...platform.settings(1),presence:'available' as const,chatDays:[0,1,2,3,4,5,6],chatStart:'00:00',chatEnd:'23:59'}),people:[{id:9001,name:'Preview Therapist',title:'Counseling psychologist',specialties:[],bio:'Local visual fixture',education:[],yearsExperience:4,languages:['Amharic','English'],approaches:[],priceOnline:1100,priceInPerson:1500,rating:0,reviewCount:0,availability:'',imageColor:'',gender:'Unspecified' as const}],wallet:{wallets:[],credit_lots:[],payment_requests:[{id:'preview',kind:'combined',principal_cents:57000,fee_cents:2850,method:'telebirr',reference:'PREVIEW-ONLY',status:'pending',created_at:'2026-10-03T10:00:00Z'}],session_funds:[],refund_requests:[],wallet_ledger:[],terms_acceptances:[{audience:'client',version:'2026-10-03.2'}]}};
 if (['booking','chat-no-package','chat-guest'].includes(params.get('screen') || '')) return <Context.Provider value={{...fixture, directoryReady:true, directoryError:'', userId:params.get('screen')==='chat-guest'?null:fixture.userId, ownTherapistId:null, balance:()=>({texts:0,voiceSeconds:0}), settings:()=>({...fixture.settings(),lastSeenAt:new Date().toISOString()})}}>{params.get('screen')==='booking'?<Directory/>:<Chat/>}</Context.Provider>;
 return <Context.Provider value={fixture}>{params.get('screen')==='studio'?<Page><AdminBroadcast people={fixture.people} adminRequest={async(init)=>Response.json(init?.method==='POST'?{id:'local-preview'}:{title:'አዲስ Psychology',canPost:true,canLaunch:true})}/></Page>:params.get('screen')==='chat'?<Chat/>:params.get('screen')==='account'?<Page><Account/></Page>:params.get('screen')==='payment'?<Page><div className="care-page"><PaymentCheckout kind="combined"/></div></Page>:params.get('screen')==='popup'?<Page><h1>Local preview</h1><OnlineTherapistPopup/></Page>:<Wallet/>}</Context.Provider>;
}
export default function Preview(){return <Suspense><Fixture/></Suspense>}
