"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { getSupabase } from './supabase';
import { usePageVisible } from './usePageVisible';
import { subscribePrivate } from './realtime-lifecycle';
export type PaymentRow={id:string;kind:string;principal_cents:number;fee_cents:number;method:string;reference:string;status:string;created_at:string};
export type CreditLot={id:string;texts:number;voice_seconds:number;principal_cents:number;initial_texts:number;initial_voice_seconds:number};
export type RefundRow={id:string;amount_cents:number;status:string;due_at:string;transfer_reference?:string};
export type WalletData={wallets:{available_cents:number}[];credit_lots:CreditLot[];payment_requests:PaymentRow[];session_funds:{appointment_id:string;amount_cents:number;status:string}[];refund_requests:RefundRow[];wallet_ledger:{id:number;kind:string;amount_cents:number;created_at:string}[];terms_acceptances:{audience:string;version:string}[]};
export function useWallet(userId:string|null){
 const visiblePage=usePageVisible();
 const [snapshot,setSnapshot]=useState<{userId:string;data:WalletData}|null>(null);const [error,setError]=useState('');
 const pending=useRef<{userId:string;task:Promise<void>}|null>(null);
 const refresh=useCallback(async()=>{if(!userId)return;if(pending.current?.userId===userId)return pending.current.task;const task=(async()=>{try{const db=getSupabase();if(!db)return;
const columns={wallets:'available_cents',credit_lots:'id,texts,voice_seconds,principal_cents,initial_texts,initial_voice_seconds',payment_requests:'id,kind,principal_cents,fee_cents,method,reference,status,created_at',session_funds:'appointment_id,amount_cents,status',refund_requests:'id,amount_cents,status,due_at,transfer_reference',wallet_ledger:'id,kind,amount_cents,created_at',terms_acceptances:'audience,version'};
const tables=Object.keys(columns) as (keyof typeof columns)[];
const rows=await Promise.all(tables.map(table=>db.from(table).select(columns[table]).eq('user_id',userId).limit(500)));
if(rows.some(row=>row.error))throw new Error('Your wallet is temporarily unavailable.');
const data=Object.fromEntries(tables.map((table,i)=>[table,rows[i].data])) as unknown as WalletData;setSnapshot({userId,data});setError('');}catch(e){setError(e instanceof Error?e.message:'Wallet unavailable');}})();pending.current={userId,task};try{await task;}finally{if(pending.current?.task===task)pending.current=null;}},[userId]);
 useEffect(()=>{
  if(!userId || !visiblePage)return;
  let connected=false,lastRefresh=0;
  const visible=()=>{if(document.visibilityState==='visible'&&Date.now()-lastRefresh>(connected?300000:10000)){lastRefresh=Date.now();void refresh();}};
  const timer=setTimeout(visible,0);
  const poll=setInterval(()=>{if(Date.now()-lastRefresh>=(connected?300000:60000))visible();},30000);
  document.addEventListener('visibilitychange',visible);
  window.addEventListener('focus',visible);
  const db=getSupabase();
  const close=db ? subscribePrivate(db,'wallet:'+userId,channel=>channel
   .on('postgres_changes',{event:'*',schema:'public',table:'payment_requests',filter:'user_id=eq.'+userId},()=>void refresh())
   .on('postgres_changes',{event:'*',schema:'public',table:'credit_lots',filter:'user_id=eq.'+userId},()=>void refresh())
   .subscribe(status=>{const reconnect=connected===false&&status==='SUBSCRIBED';connected=status==='SUBSCRIBED';if(reconnect)visible();})) : null;
  return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);close?.();};
 },[refresh,userId,visiblePage]);
 return {data:snapshot?.userId===userId?snapshot.data:null,error,refresh};
}

