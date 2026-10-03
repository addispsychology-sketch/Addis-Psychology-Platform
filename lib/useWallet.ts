"use client";
import { useCallback,useEffect,useState } from 'react';
import { authenticatedFetch } from './supabase';
export type PaymentRow={id:string;kind:string;principal_cents:number;fee_cents:number;method:string;reference:string;status:string;created_at:string};
export type CreditLot={id:string;texts:number;voice_seconds:number;principal_cents:number;initial_texts:number;initial_voice_seconds:number};
export type RefundRow={id:string;amount_cents:number;status:string;due_at:string;transfer_reference?:string};
export type WalletData={wallets:{available_cents:number}[];credit_lots:CreditLot[];payment_requests:PaymentRow[];session_funds:{appointment_id:string;amount_cents:number;status:string}[];refund_requests:RefundRow[];wallet_ledger:{id:number;kind:string;amount_cents:number;created_at:string}[];terms_acceptances:{audience:string;version:string}[]};
export function useWallet(userId:string|null){
 const [snapshot,setSnapshot]=useState<{userId:string;data:WalletData}|null>(null);const [error,setError]=useState('');
 const refresh=useCallback(async()=>{if(!userId)return;try{const data=await authenticatedFetch('/api/wallet');setSnapshot({userId,data});setError('');}catch(e){setError(e instanceof Error?e.message:'Wallet unavailable');}},[userId]);
 useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);const poll=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);return()=>{clearTimeout(timer);clearInterval(poll)}},[refresh]);
 return {data:snapshot?.userId===userId?snapshot.data:null,error,refresh};
}
