"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { getSupabase } from './supabase';
export type PaymentRow={id:string;kind:string;principal_cents:number;fee_cents:number;method:string;reference:string;status:string;created_at:string};
export type CreditLot={id:string;texts:number;voice_seconds:number;principal_cents:number;initial_texts:number;initial_voice_seconds:number};
export type RefundRow={id:string;amount_cents:number;status:string;due_at:string;transfer_reference?:string};
export type WalletData={wallets:{available_cents:number}[];credit_lots:CreditLot[];payment_requests:PaymentRow[];session_funds:{appointment_id:string;amount_cents:number;status:string}[];refund_requests:RefundRow[];wallet_ledger:{id:number;kind:string;amount_cents:number;created_at:string}[];terms_acceptances:{audience:string;version:string}[]};
export function useWallet(userId:string|null){
 const [snapshot,setSnapshot]=useState<{userId:string;data:WalletData}|null>(null);const [error,setError]=useState('');
 const pending=useRef<Promise<void>|null>(null);
 const refresh=useCallback(async()=>{if(!userId)return;if(pending.current)return pending.current;const task=(async()=>{try{const db=getSupabase();if(!db)return;
const tables=['wallets','credit_lots','payment_requests','session_funds','refund_requests','wallet_ledger','terms_acceptances'];
const rows=await Promise.all(tables.map(table=>db.from(table).select('*').eq('user_id',userId).limit(500)));
if(rows.some(row=>row.error))throw new Error('Your wallet is temporarily unavailable.');
const data=Object.fromEntries(tables.map((table,i)=>[table,rows[i].data])) as WalletData;setSnapshot({userId,data});setError('');}catch(e){setError(e instanceof Error?e.message:'Wallet unavailable');}})();pending.current=task;try{await task;}finally{pending.current=null;}},[userId]);
 useEffect(()=>{const visible=()=>{if(document.visibilityState==='visible')void refresh()};const timer=setTimeout(visible,0);const poll=setInterval(visible,120000);window.addEventListener('focus',visible); const db=getSupabase(); const channel=db&&userId?db.channel('wallet:'+userId,{config:{private:true}}).on('postgres_changes',{event:'*',schema:'public',table:'payment_requests'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'credit_lots'},()=>void refresh()).subscribe():null; return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',visible);if(db&&channel)db.removeChannel(channel)}},[refresh,userId]);
 return {data:snapshot?.userId===userId?snapshot.data:null,error,refresh};
}

