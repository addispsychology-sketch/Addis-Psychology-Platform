"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { getSupabase } from './supabase';
import { usePageVisible } from './usePageVisible';
import { subscribePrivate } from './realtime-lifecycle';

export type PaymentRow={id:string;kind:string;principal_cents:number;fee_cents:number;method:string;reference:string;status:string;created_at:string};
export type CreditLot={id:string;texts:number;voice_seconds:number;principal_cents:number;initial_texts:number;initial_voice_seconds:number};
export type RefundRow={id:string;amount_cents:number;status:string;due_at:string;transfer_reference?:string};
export type WalletData={wallets:{available_cents:number}[];credit_lots:CreditLot[];payment_requests:PaymentRow[];session_funds:{appointment_id:string;amount_cents:number;status:string}[];refund_requests:RefundRow[];wallet_ledger:{id:number;kind:string;amount_cents:number;created_at:string}[];terms_acceptances:{audience:string;version:string}[]};

const columns={wallets:'available_cents',credit_lots:'id,texts,voice_seconds,principal_cents,initial_texts,initial_voice_seconds',payment_requests:'id,kind,principal_cents,fee_cents,method,reference,status,created_at',session_funds:'appointment_id,amount_cents,status',refund_requests:'id,amount_cents,status,due_at,transfer_reference',wallet_ledger:'id,kind,amount_cents,created_at',terms_acceptances:'audience,version'};
type TableName = keyof typeof columns;

export function useWallet(userId:string|null){
 const visiblePage=usePageVisible();
 const [snapshot,setSnapshot]=useState<{userId:string;data:WalletData}|null>(null);
 const [error,setError]=useState('');
 const pending=useRef<{userId:string;task:Promise<void>}|null>(null);

 const refresh=useCallback(async(specificTable?: TableName)=>{
  if(!userId)return;
  const db=getSupabase();
  if(!db)return;

  try {
   if (specificTable) {
    const { data, error } = await db.from(specificTable).select(columns[specificTable]).eq('user_id',userId).limit(50);
    if (error) throw new Error('Wallet unavailable');
    setSnapshot(prev => prev?.userId === userId ? { userId, data: { ...prev.data, [specificTable]: data } as WalletData } : prev);
    return;
   }

   if(pending.current?.userId===userId)return pending.current.task;
   const task=(async()=>{
    try{
     const tables=Object.keys(columns) as TableName[];
     const rows=await Promise.all(tables.map(table=>db.from(table).select(columns[table]).eq('user_id',userId).limit(50)));
     if(rows.some(row=>row.error))throw new Error('Your wallet is temporarily unavailable.');
     const data=Object.fromEntries(tables.map((table,i)=>[table,rows[i].data])) as unknown as WalletData;
     setSnapshot({userId,data});
     setError('');
    }catch(e){setError(e instanceof Error?e.message:'Wallet unavailable');}
   })();
   pending.current={userId,task};
   try{await task;}finally{if(pending.current?.task===task)pending.current=null;}
  } catch (e) {
   setError(e instanceof Error?e.message:'Wallet unavailable');
  }
 },[userId]);

 useEffect(()=>{
  if(!userId || !visiblePage)return;
  let connected=false,lastRefresh=0;
  const visible=()=>{if(document.visibilityState==='visible'&&Date.now()-lastRefresh>(connected?300000:10000)){lastRefresh=Date.now();void refresh();}};
  const timer=setTimeout(visible,0);

  document.addEventListener('visibilitychange',visible);
  window.addEventListener('focus',visible);
  const db=getSupabase();

  const close=db ? subscribePrivate(db,'wallet:'+userId,channel=> {
   const c = channel;
   Object.keys(columns).forEach(t => {
     c.on('postgres_changes',{event:'*',schema:'public',table:t,filter:'user_id=eq.'+userId},()=>void refresh(t as TableName));
   });
   return c.subscribe(status=>{
    const reconnect=connected===false&&status==='SUBSCRIBED';
    connected=status==='SUBSCRIBED';
    if(reconnect)visible();
   });
  }) : null;

  return()=>{
   clearTimeout(timer);
   window.removeEventListener('focus',visible);
   document.removeEventListener('visibilitychange',visible);
   close?.();
  };
 },[refresh,userId,visiblePage]);

 return {data:snapshot?.userId===userId?snapshot.data:null,error,refresh: () => refresh()};
}
